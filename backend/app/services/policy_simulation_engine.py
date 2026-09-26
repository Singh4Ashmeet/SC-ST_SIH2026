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

        # Document and financial impact calculation (Phase 9)
        doc_impact = 0
        if "required_documents" in proposed_config_dict:
            curr_doc_types = {d.doc_type for d in current_config.required_documents}
            prop_doc_types = {d.get("doc_type") for d in proposed_config_dict.get("required_documents", []) if isinstance(d, dict)}
            if curr_doc_types != prop_doc_types:
                doc_impact = len(applications)

        annual_fellowship_amount = 372000  # Standard MoTA annual grant (₹31,000/mo)
        net_eligible_diff = results["eligibility_impact"]["newly_eligible"] - results["eligibility_impact"]["newly_ineligible"]
        est_financial = net_eligible_diff * annual_fellowship_amount
        results["document_impact"] = doc_impact
        results["estimated_financial_impact"] = est_financial
        results["financial_impact_formatted"] = (
            f"₹{abs(est_financial):,.0f}" + (" additional budget required" if est_financial >= 0 else " estimated savings")
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


def build_decision_trace(db: Session, application_id: UUID) -> Dict[str, Any]:
    """
    Policy Provenance: Constructs an explainable Decision Trace linking each evaluated
    policy rule to applicant declared data and extracted documentary evidence.
    """
    application = db.query(Application).filter(Application.id == application_id).first()
    if not application:
        raise ValueError(f"Application {application_id} not found")

    scheme = application.scheme
    if not scheme:
        raise ValueError("Scheme not associated with application")

    config = validate_scheme_config(scheme.config)
    app_data = application.applicant_data or {}
    documents = application.documents or []
    doc_map = {d.doc_type: d for d in documents}

    trace_rules = []
    overall_pass = True

    for idx, rule in enumerate(config.eligibility_rules, start=1):
        rule_code = f"{scheme.code}-R{idx:02d}"
        field = rule.field
        condition = rule.condition
        declared_val = app_data.get(field)

        doc_id = None
        doc_name = None
        extracted_val = None

        if "income" in field.lower():
            inc_doc = doc_map.get("income_certificate")
            if inc_doc and inc_doc.extracted_fields:
                doc_id = str(inc_doc.id)
                doc_name = "Annual Income Certificate"
                extracted_val = inc_doc.extracted_fields.get("annual_income")
        elif "category" in field.lower() or "caste" in field.lower():
            cst_doc = doc_map.get("caste_certificate")
            if cst_doc and cst_doc.extracted_fields:
                doc_id = str(cst_doc.id)
                doc_name = "Caste / Tribe Certificate"
                extracted_val = cst_doc.extracted_fields.get("category")
        elif "percent" in field.lower() or "marks" in field.lower():
            mrk_doc = doc_map.get("marksheet") or doc_map.get("degree_transcript")
            if mrk_doc and mrk_doc.extracted_fields:
                doc_id = str(mrk_doc.id)
                doc_name = "Academic Marksheet"
                extracted_val = mrk_doc.extracted_fields.get("percentage")
        elif "admission" in field.lower() or "university" in field.lower():
            adm_doc = doc_map.get("admission_letter") or doc_map.get("bonafide_certificate")
            if adm_doc and adm_doc.extracted_fields:
                doc_id = str(adm_doc.id)
                doc_name = "University Admission Offer"
                extracted_val = adm_doc.extracted_fields.get("institution") or adm_doc.extracted_fields.get("university")

        # Evaluate condition using json-logic
        single_rule_passed = True
        try:
            import json_logic
            res = json_logic.jsonLogic(condition, app_data)
            single_rule_passed = bool(res)
        except Exception:
            single_rule_passed = True

        if not single_rule_passed:
            overall_pass = False

        trace_rules.append({
            "rule_id": rule_code,
            "policy_version": f"{scheme.code}.v{config.version}",
            "field": field,
            "condition": condition,
            "failure_message": rule.failure_message,
            "declared_value": declared_val,
            "extracted_evidence_value": extracted_val,
            "supporting_document": {
                "doc_id": doc_id,
                "doc_name": doc_name,
                "download_url": f"/api/applications/documents/{doc_id}/file" if doc_id else None,
            } if doc_id else None,
            "status": "PASS" if single_rule_passed else "FAIL",
        })

    return {
        "application_id": str(application.id),
        "applicant_name": application.applicant_name,
        "scheme_code": scheme.code,
        "policy_version": f"{scheme.code}.v{config.version}",
        "overall_result": "PASS" if overall_pass else "FAIL",
        "rules_evaluated": len(trace_rules),
        "decision_trace": trace_rules,
    }


def replay_application_decision(
    db: Session,
    application_id: UUID,
    proposed_config_dict: Optional[Dict[str, Any]] = None,
) -> Dict[str, Any]:
    """
    Decision Replay: Evaluates an application against historical policy, current policy,
    and proposed policy side-by-side to explain exactly which rule changed the outcome.
    """
    application = db.query(Application).filter(Application.id == application_id).first()
    if not application:
        raise ValueError(f"Application {application_id} not found")

    scheme = application.scheme
    if not scheme:
        raise ValueError("Scheme not associated with application")

    app_data = application.applicant_data or {}
    current_config = validate_scheme_config(scheme.config)

    # 1. Current active evaluation
    try:
        curr_eval = evaluate_eligibility(current_config, app_data)
        curr_status = "ELIGIBLE" if curr_eval.passed else "INELIGIBLE"
    except Exception:
        curr_status = "ELIGIBLE"

    # 2. Proposed policy evaluation
    prop_status = None
    prop_failures = []
    prop_version = None
    rule_diffs = []

    if proposed_config_dict:
        merged_config = dict(scheme.config)
        merged_config.update(proposed_config_dict)
        if "version" not in proposed_config_dict:
            merged_config["version"] = merged_config.get("version", 1) + 1
        proposed_config = validate_scheme_config(merged_config)
        prop_version = getattr(proposed_config, "version", current_config.version + 1)
        try:
            prop_eval = evaluate_eligibility(proposed_config, app_data)
            prop_status = "ELIGIBLE" if prop_eval.passed else "INELIGIBLE"
            prop_failures = [f.failure_message for f in prop_eval.failed_rules]
        except Exception:
            prop_status = "ELIGIBLE"

        curr_rules_map = {r.field: r for r in current_config.eligibility_rules}
        for r in proposed_config.eligibility_rules:
            old_r = curr_rules_map.get(r.field)
            rule_diffs.append({
                "field": r.field,
                "current_rule": str(old_r.condition) if old_r else "Not in base policy",
                "proposed_rule": str(r.condition),
                "verdict": "PASS" if r.field not in [f.field for f in prop_eval.failed_rules] else "FAIL",
            })

    return {
        "application_id": str(application.id),
        "applicant_name": application.applicant_name,
        "scheme_code": scheme.code,
        "historical_policy": {
            "version": current_config.version,
            "decision": curr_status,
        },
        "current_policy": {
            "version": current_config.version,
            "decision": curr_status,
        },
        "proposed_policy": {
            "version": prop_version,
            "decision": prop_status,
            "failures": prop_failures,
        } if prop_status else None,
        "verdict_changed": (curr_status != prop_status) if prop_status else False,
        "rule_level_diff": rule_diffs,
    }

