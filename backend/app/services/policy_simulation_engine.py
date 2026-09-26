"""
Policy Simulation Engine — What-if analysis for scheme configuration changes.

Yojana Setu (SIH26239) — Ministry of Tribal Affairs

Allows admins to simulate proposed changes to eligibility rules, merit criteria,
and income thresholds against existing application data, showing impact BEFORE
publishing the new config.
"""

import logging
from typing import Any, Dict, List, Optional
from uuid import UUID

from sqlalchemy import select, func as sqla_func
from sqlalchemy.orm import Session

from app.models.application import Application
from app.models.policy_simulation import PolicySimulation
from app.models.scheme import Scheme
from app.schemas.scheme_config import SchemeConfig, SchemeConfigValidationError
from app.services.eligibility_engine import evaluate_eligibility
from app.services.merit_engine import compute_merit_score
from app.services.scheme_config_validator import validate_scheme_config

logger = logging.getLogger(__name__)


def simulate_policy_change(
    db: Session,
    scheme_id: UUID,
    proposed_config_dict: Dict[str, Any],
    run_by: Optional[UUID] = None,
    simulation_name: Optional[str] = None,
) -> Dict[str, Any]:
    """
    Simulate the impact of proposed scheme configuration changes.

    Runs eligibility and merit scoring on existing applications
    using both the current config and the proposed config, then
    computes a diff of outcomes.

    Args:
        db: Database session.
        scheme_id: The scheme to simulate changes for.
        proposed_config_dict: The proposed new config as a dict.
        run_by: UUID of the admin running the simulation.
        simulation_name: Optional name for the simulation run.

    Returns:
        Dict with simulation results including impact summary.
    """
    # Fetch scheme
    scheme = db.execute(
        select(Scheme).where(Scheme.id == scheme_id)
    ).scalar_one_or_none()

    if not scheme:
        raise ValueError(f"Scheme {scheme_id} not found")

    current_config = SchemeConfig(**scheme.config)

    # Validate proposed config
    try:
        proposed_config = validate_scheme_config(proposed_config_dict)
    except SchemeConfigValidationError as e:
        return {
            "valid": False,
            "validation_errors": e.errors,
        }

    # Fetch all non-terminal applications
    terminal_states = {"rejected", "withdrawn", "cancelled", "disbursed"}
    applications = db.execute(
        select(Application).where(
            Application.scheme_id == scheme_id,
            Application.current_state.not_in(terminal_states),
        )
    ).scalars().all()

    # ── Run simulation ──
    results = {
        "total_applications": len(applications),
        "eligibility_impact": {
            "newly_eligible": 0,
            "newly_ineligible": 0,
            "unchanged": 0,
            "details": [],
        },
        "merit_impact": {
            "score_changes": [],
            "rank_changes": [],
            "avg_score_current": 0.0,
            "avg_score_proposed": 0.0,
        },
    }

    if not applications:
        results["summary"] = "No active applications to simulate against."
    else:
        current_scores = []
        proposed_scores = []

        for app in applications:
            app_data = app.applicant_data or {}

            # ── Eligibility comparison ──
            try:
                current_result = evaluate_eligibility(
                    current_config, app_data
                )
                was_eligible = current_result.passed
                current_failures = [r.failure_message for r in current_result.failed_rules]
            except Exception:
                was_eligible = True
                current_failures = []

            try:
                proposed_result = evaluate_eligibility(
                    proposed_config, app_data
                )
                now_eligible = proposed_result.passed
                proposed_failures = [r.failure_message for r in proposed_result.failed_rules]
            except Exception:
                now_eligible = True
                proposed_failures = []

            if was_eligible and not now_eligible:
                results["eligibility_impact"]["newly_ineligible"] += 1
                results["eligibility_impact"]["details"].append({
                    "application_id": str(app.id),
                    "applicant_name": app.applicant_name,
                    "change": "became_ineligible",
                    "reasons": proposed_failures,
                })
            elif not was_eligible and now_eligible:
                results["eligibility_impact"]["newly_eligible"] += 1
                results["eligibility_impact"]["details"].append({
                    "application_id": str(app.id),
                    "applicant_name": app.applicant_name,
                    "change": "became_eligible",
                })
            else:
                results["eligibility_impact"]["unchanged"] += 1

            # ── Merit scoring comparison ──
            if current_config.merit_criteria:
                current_merit = compute_merit_score(
                    app_data, current_config.merit_criteria, current_config.preference_rules
                )
                current_scores.append(current_merit["total_score"])
            else:
                current_merit = {"total_score": 0}

            if proposed_config.merit_criteria:
                proposed_merit = compute_merit_score(
                    app_data, proposed_config.merit_criteria, proposed_config.preference_rules
                )
                proposed_scores.append(proposed_merit["total_score"])
            else:
                proposed_merit = {"total_score": 0}

            score_delta = proposed_merit["total_score"] - current_merit["total_score"]
            if abs(score_delta) > 0.01:
                results["merit_impact"]["score_changes"].append({
                    "application_id": str(app.id),
                    "applicant_name": app.applicant_name,
                    "current_score": current_merit["total_score"],
                    "proposed_score": proposed_merit["total_score"],
                    "delta": round(score_delta, 4),
                })

        # Compute averages
        if current_scores:
            results["merit_impact"]["avg_score_current"] = round(
                sum(current_scores) / len(current_scores), 4
            )
        if proposed_scores:
            results["merit_impact"]["avg_score_proposed"] = round(
                sum(proposed_scores) / len(proposed_scores), 4
            )

        # ── Build summary ──
        ei = results["eligibility_impact"]
        mi = results["merit_impact"]
        summary_parts = [
            f"Simulated against {len(applications)} active application(s).",
        ]

        if ei["newly_ineligible"] > 0:
            summary_parts.append(
                f"⚠️ {ei['newly_ineligible']} applicant(s) would become INELIGIBLE."
            )
        if ei["newly_eligible"] > 0:
            summary_parts.append(
                f"✅ {ei['newly_eligible']} applicant(s) would become newly eligible."
            )
        if mi["score_changes"]:
            summary_parts.append(
                f"📊 {len(mi['score_changes'])} applicant(s) would see score changes."
            )

        results["summary"] = " ".join(summary_parts)

    # ── Persist simulation record ──
    simulation = PolicySimulation(
        scheme_id=scheme_id,
        simulation_name=simulation_name or f"Simulation v{current_config.version} → proposed",
        base_config_version=current_config.version,
        base_config=scheme.config,
        proposed_config=proposed_config_dict,
        results=results,
        summary=results.get("summary", ""),
        run_by=run_by,
    )
    db.add(simulation)
    db.flush()

    results["simulation_id"] = str(simulation.id)
    results["valid"] = True

    logger.info(
        f"Policy simulation complete for scheme {scheme.code}: "
        f"{results.get('summary', '')}"
    )

    return results
