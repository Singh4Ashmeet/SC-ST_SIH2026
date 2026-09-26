"""
Merit Engine — Config-driven scoring and ranking of applicants.

Yojana Setu (SIH26239) — Ministry of Tribal Affairs

Reads merit_criteria and preference_rules from SchemeConfig,
evaluates each applicant's data, and produces a ranked score breakdown.
All decisions are traceable to the config version.
"""

import logging
from typing import Any, Dict, List, Optional, Tuple
from uuid import UUID

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.models.application import Application
from app.models.merit_evaluation import MeritEvaluation
from app.models.scheme import Scheme
from app.schemas.scheme_config import MeritCriterion, PreferenceRule, SchemeConfig

logger = logging.getLogger(__name__)


class MeritEngineError(Exception):
    """Custom error for merit engine failures."""
    pass


def _evaluate_preference(
    rule: PreferenceRule,
    applicant_data: Dict[str, Any],
) -> Tuple[bool, float]:
    """
    Evaluate a preference rule against applicant data using json_logic.

    Returns (matched, bonus_points).
    """
    try:
        from json_logic import jsonLogic
        result = jsonLogic(rule.condition, applicant_data)
        if result:
            return True, rule.bonus_points
    except Exception as e:
        logger.warning(f"Preference rule '{rule.name}' evaluation failed: {e}")
    return False, 0.0


def compute_merit_score(
    applicant_data: Dict[str, Any],
    criteria: List[MeritCriterion],
    preference_rules: List[PreferenceRule],
) -> Dict[str, Any]:
    """
    Compute a merit score for a single applicant based on scheme criteria.

    Args:
        applicant_data: The applicant's form data (from application.applicant_data).
        criteria: The merit_criteria from SchemeConfig.
        preference_rules: The preference_rules from SchemeConfig.

    Returns:
        Dict with total_score, score_breakdown, preference_factors.
    """
    if not criteria:
        return {
            "total_score": 0.0,
            "score_breakdown": {},
            "preference_factors": {},
            "notes": "No merit criteria defined for this scheme.",
        }

    score_breakdown = {}
    weighted_total = 0.0

    for criterion in criteria:
        raw_value = applicant_data.get(criterion.field, 0)

        # Coerce to float safely
        try:
            raw_score = float(raw_value) if raw_value is not None else 0.0
        except (TypeError, ValueError):
            raw_score = 0.0

        # Normalize: score / max_score * weight
        capped_score = min(raw_score, criterion.max_score)
        normalized = (capped_score / criterion.max_score) * criterion.weight if criterion.max_score > 0 else 0.0

        score_breakdown[criterion.field] = {
            "name": criterion.name,
            "raw_score": raw_score,
            "max_score": criterion.max_score,
            "weight": criterion.weight,
            "weighted_score": round(normalized, 4),
        }
        weighted_total += normalized

    # Evaluate preference rules (bonus points)
    preference_factors = {}
    total_bonus = 0.0

    for rule in preference_rules:
        matched, bonus = _evaluate_preference(rule, applicant_data)
        preference_factors[rule.name] = {
            "field": rule.field,
            "matched": matched,
            "bonus_points": bonus,
            "description": rule.description,
        }
        total_bonus += bonus

    return {
        "total_score": round(weighted_total + total_bonus, 4),
        "base_score": round(weighted_total, 4),
        "bonus_score": round(total_bonus, 4),
        "score_breakdown": score_breakdown,
        "preference_factors": preference_factors,
    }


def evaluate_and_rank_scheme(
    db: Session,
    scheme_id: UUID,
    evaluator_id: Optional[UUID] = None,
) -> List[MeritEvaluation]:
    """
    Evaluate all eligible applications for a scheme and assign ranks.

    - Only considers applications in 'selection' state (or configurable).
    - Clears previous evaluations for the same scheme+config version.
    - Creates MeritEvaluation records with scores and ranks.

    Returns the list of MeritEvaluation records ordered by rank.
    """
    # Fetch scheme and parse config
    scheme = db.execute(
        select(Scheme).where(Scheme.id == scheme_id)
    ).scalar_one_or_none()

    if not scheme:
        raise MeritEngineError(f"Scheme {scheme_id} not found.")

    config = SchemeConfig(**scheme.config)

    if not config.merit_criteria:
        raise MeritEngineError(
            f"Scheme '{scheme.code}' has no merit_criteria defined. "
            f"Add merit_criteria to the scheme config before running evaluation."
        )

    # Fetch applications in selection-eligible states
    selection_states = {"selection", "document_scrutiny_passed", "institute_verified"}
    applications = db.execute(
        select(Application).where(
            Application.scheme_id == scheme_id,
            Application.current_state.in_(selection_states),
        )
    ).scalars().all()

    if not applications:
        logger.info(f"No applications in selection-eligible states for scheme {scheme.code}")
        return []

    # Evaluate each application
    scored: List[Tuple[Application, Dict[str, Any]]] = []
    for app in applications:
        result = compute_merit_score(
            applicant_data=app.applicant_data or {},
            criteria=config.merit_criteria,
            preference_rules=config.preference_rules,
        )
        scored.append((app, result))

    # Sort by total_score descending (higher = better rank)
    scored.sort(key=lambda x: x[1]["total_score"], reverse=True)

    # Clear previous evaluations for this config version
    existing = db.execute(
        select(MeritEvaluation).where(
            MeritEvaluation.scheme_id == scheme_id,
            MeritEvaluation.scheme_config_version == config.version,
        )
    ).scalars().all()
    for ev in existing:
        db.delete(ev)
    db.flush()

    # Create ranked evaluation records
    evaluations: List[MeritEvaluation] = []
    for rank, (app, result) in enumerate(scored, start=1):
        evaluation = MeritEvaluation(
            application_id=app.id,
            scheme_id=scheme_id,
            total_score=result["total_score"],
            rank=rank,
            score_breakdown=result["score_breakdown"],
            preference_factors=result.get("preference_factors"),
            scheme_config_version=config.version,
            evaluated_by=evaluator_id,
        )
        db.add(evaluation)
        evaluations.append(evaluation)

    db.flush()

    logger.info(
        f"Merit evaluation complete for scheme {scheme.code}: "
        f"{len(evaluations)} applications ranked"
    )

    return evaluations
