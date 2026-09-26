"""
Conflict Engine — Cross-scheme duplicate beneficiary detection.

Yojana Setu (SIH26239) — Ministry of Tribal Affairs

Detects cross-scheme conflicts by matching applicant identity signals
(name, DOB, phone, email, Aadhaar digest) across active applications.
All detections require human-in-the-loop review.
"""

import logging
from difflib import SequenceMatcher
from typing import Any, Dict, List, Optional, Set, Tuple
from uuid import UUID

from sqlalchemy import select, and_, or_
from sqlalchemy.orm import Session

from app.models.application import Application
from app.models.conflict import Conflict, ConflictStatus, ConflictType
from app.models.scheme import Scheme
from app.schemas.scheme_config import ConflictRule, SchemeConfig

logger = logging.getLogger(__name__)


def _normalize(value: Any) -> str:
    """Normalize a value for fuzzy comparison."""
    if value is None:
        return ""
    return str(value).strip().lower().replace(" ", "")


def _name_similarity(name1: str, name2: str) -> float:
    """Compute name similarity using SequenceMatcher."""
    n1 = _normalize(name1)
    n2 = _normalize(name2)
    if not n1 or not n2:
        return 0.0
    return SequenceMatcher(None, n1, n2).ratio()


def _compute_match_confidence(
    app1_data: Dict[str, Any],
    app2_data: Dict[str, Any],
    app1_name: str,
    app2_name: str,
    app1_email: str,
    app2_email: str,
    matching_fields: List[str],
) -> Tuple[float, Dict[str, Any]]:
    """
    Compute match confidence between two applications.

    Returns (confidence_0_to_1, matching_signals_dict).
    """
    signals: Dict[str, Any] = {}
    total_weight = 0.0
    matched_weight = 0.0

    # Field-weight mapping
    field_weights = {
        "applicant_name": 25.0,
        "date_of_birth": 30.0,
        "mobile": 20.0,
        "applicant_email": 15.0,
        "aadhaar_last_four": 10.0,
        "father_name": 10.0,
        "mother_name": 10.0,
        "address_state": 5.0,
    }

    for field in matching_fields:
        weight = field_weights.get(field, 10.0)
        total_weight += weight

        if field == "applicant_name":
            sim = _name_similarity(app1_name, app2_name)
            signals["name_similarity"] = round(sim, 3)
            if sim >= 0.85:
                matched_weight += weight
            elif sim >= 0.70:
                matched_weight += weight * 0.5
        elif field == "applicant_email":
            if _normalize(app1_email) == _normalize(app2_email) and app1_email:
                signals["email_match"] = True
                matched_weight += weight
            else:
                signals["email_match"] = False
        else:
            val1 = _normalize(app1_data.get(field))
            val2 = _normalize(app2_data.get(field))
            if val1 and val2 and val1 == val2:
                signals[f"{field}_match"] = True
                matched_weight += weight
            elif val1 and val2:
                signals[f"{field}_match"] = False

    confidence = matched_weight / total_weight if total_weight > 0 else 0.0
    return round(confidence, 4), signals


def detect_conflicts_for_application(
    db: Session,
    application_id: UUID,
    threshold: float = 0.6,
) -> List[Conflict]:
    """
    Detect cross-scheme conflicts for a specific application.

    Compares the application against all other active applications
    in different schemes, using the scheme's conflict_rules config.

    Args:
        db: Database session.
        application_id: The application to check.
        threshold: Minimum confidence to flag a conflict (0.0-1.0).

    Returns:
        List of newly created Conflict records.
    """
    # Fetch the application
    application = db.execute(
        select(Application).where(Application.id == application_id)
    ).scalar_one_or_none()

    if not application:
        logger.warning(f"Application {application_id} not found for conflict check")
        return []

    # Fetch the scheme config
    scheme = db.execute(
        select(Scheme).where(Scheme.id == application.scheme_id)
    ).scalar_one_or_none()

    if not scheme:
        return []

    config = SchemeConfig(**scheme.config)

    # Determine matching fields from conflict rules (or use defaults)
    matching_fields = ["applicant_name", "date_of_birth", "mobile", "applicant_email"]
    incompatible_schemes: Set[str] = set()

    for rule in config.conflict_rules:
        matching_fields = rule.matching_fields or matching_fields
        incompatible_schemes.update(rule.incompatible_schemes)

    # Terminal states should not be considered for conflict detection
    terminal_states = {"rejected", "withdrawn", "cancelled"}

    # Find candidate applications from OTHER schemes
    candidates_query = select(Application).where(
        Application.id != application_id,
        Application.current_state.not_in(terminal_states),
    )

    # If incompatible schemes are specified, filter to those; otherwise check all
    if incompatible_schemes:
        incompatible_scheme_ids = db.execute(
            select(Scheme.id).where(Scheme.code.in_(incompatible_schemes))
        ).scalars().all()
        if incompatible_scheme_ids:
            candidates_query = candidates_query.where(
                Application.scheme_id.in_(incompatible_scheme_ids)
            )
        else:
            # No matching incompatible schemes found — check all other schemes
            candidates_query = candidates_query.where(
                Application.scheme_id != application.scheme_id
            )
    else:
        # No rules defined — check all other schemes
        candidates_query = candidates_query.where(
            Application.scheme_id != application.scheme_id
        )

    candidates = db.execute(candidates_query).scalars().all()

    # Check for existing unresolved conflicts to avoid duplicates
    existing_conflicts = db.execute(
        select(Conflict).where(
            Conflict.application_id == application_id,
            Conflict.status.in_([ConflictStatus.PENDING_REVIEW, ConflictStatus.CONFIRMED]),
        )
    ).scalars().all()
    existing_conflict_pairs = {
        c.conflicting_application_id for c in existing_conflicts
    }

    new_conflicts: List[Conflict] = []

    for candidate in candidates:
        # Skip if already flagged
        if candidate.id in existing_conflict_pairs:
            continue

        confidence, signals = _compute_match_confidence(
            app1_data=application.applicant_data or {},
            app2_data=candidate.applicant_data or {},
            app1_name=application.applicant_name,
            app2_name=candidate.applicant_name,
            app1_email=application.applicant_email,
            app2_email=candidate.applicant_email,
            matching_fields=matching_fields,
        )

        if confidence >= threshold:
            # Determine conflict type
            if application.scheme_id == candidate.scheme_id:
                conflict_type = ConflictType.DUPLICATE_APPLICATION
            elif confidence >= 0.9:
                conflict_type = ConflictType.IDENTITY_COLLISION
            else:
                conflict_type = ConflictType.CONCURRENT_SCHOLARSHIP

            conflict = Conflict(
                application_id=application_id,
                conflicting_application_id=candidate.id,
                conflict_type=conflict_type,
                status=ConflictStatus.PENDING_REVIEW,
                confidence=confidence,
                matching_signals=signals,
                policy_description=f"Auto-detected {conflict_type.value} with confidence {confidence:.0%}",
                explanation=(
                    f"Application by '{application.applicant_name}' matches "
                    f"'{candidate.applicant_name}' in scheme with "
                    f"confidence {confidence:.0%}"
                ),
            )
            db.add(conflict)
            new_conflicts.append(conflict)

    if new_conflicts:
        db.flush()
        logger.info(
            f"Detected {len(new_conflicts)} conflict(s) for application "
            f"{application_id}"
        )

    return new_conflicts


def get_conflict_summary(
    db: Session,
    application_id: Optional[UUID] = None,
    scheme_id: Optional[UUID] = None,
    status_filter: Optional[ConflictStatus] = None,
) -> List[Conflict]:
    """
    Fetch conflict records with optional filters.
    """
    query = select(Conflict)

    if application_id:
        query = query.where(
            or_(
                Conflict.application_id == application_id,
                Conflict.conflicting_application_id == application_id,
            )
        )
    if status_filter:
        query = query.where(Conflict.status == status_filter)

    return list(db.execute(query).scalars().all())
