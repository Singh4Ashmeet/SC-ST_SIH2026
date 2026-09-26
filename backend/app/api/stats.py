"""
Stats and dashboard metrics API router.

Endpoints for aggregated platform metrics and per-scheme breakdown.
"""

from datetime import datetime
from typing import Annotated, Any, Dict, List, Optional
import uuid

from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel, ConfigDict
from sqlalchemy import func
from sqlalchemy.orm import Session

from app.core.cache import cache
from app.core.database import get_db
from app.core.deps import require_any_role
from app.models.application import Application
from app.models.audit_log import AuditLog
from app.models.disbursement import Disbursement, DisbursementStatus
from app.models.document import Document, DocumentStatus
from app.models.renewal import Renewal, RenewalStatus
from app.models.scheme import Scheme
from app.models.user import User
from app.services.scheme_config_validator import validate_scheme_config

router = APIRouter(prefix="/stats", tags=["Stats"])


class RecentActivityItem(BaseModel):
    """Activity entry representing a recent audit action."""
    id: uuid.UUID
    action: str
    application_id: Optional[uuid.UUID] = None
    created_at: datetime

    model_config = ConfigDict(from_attributes=True)


class StatsOverview(BaseModel):
    """Aggregate dashboard metrics overview."""
    total_applications: int
    applications_by_state: Dict[str, int]
    applications_by_scheme: Dict[str, int]
    deficient_count: int
    documents_by_status: Dict[str, int]
    pending_disbursements_count: int
    total_disbursed_amount: float
    pending_renewals_count: int
    recent_activity: List[RecentActivityItem]

    model_config = ConfigDict(from_attributes=True)


def _compute_stats(db: Session, scheme_id: Optional[uuid.UUID] = None) -> Dict[str, Any]:
    """Compute aggregate or scheme-scoped platform statistics."""
    cache_key = f"stats:{scheme_id or 'overview'}"
    cached = cache.get(cache_key)
    if cached is not None:
        return cached

    # 1. Total applications
    app_query = db.query(Application)
    if scheme_id:
        app_query = app_query.filter(Application.scheme_id == scheme_id)
    total_applications = app_query.count()

    # 2. Applications by state
    state_query = db.query(Application.current_state, func.count(Application.id))
    if scheme_id:
        state_query = state_query.filter(Application.scheme_id == scheme_id)
    applications_by_state: Dict[str, int] = {
        state: count for state, count in state_query.group_by(Application.current_state).all()
    }

    # 3. Applications by scheme
    if scheme_id:
        scheme = db.query(Scheme).filter(Scheme.id == scheme_id).first()
        applications_by_scheme = {scheme.code: total_applications} if scheme else {}
    else:
        schemes = db.query(Scheme).all()
        applications_by_scheme = {s.code: 0 for s in schemes}
        scheme_counts = (
            db.query(Scheme.code, func.count(Application.id))
            .join(Application, Application.scheme_id == Scheme.id)
            .group_by(Scheme.code)
            .all()
        )
        for code, count in scheme_counts:
            applications_by_scheme[code] = count

    # 4. Deficient applications count
    # Derived from scheme workflow configuration (deficiency states) combined with
    # applications holding any DEFICIENT document.
    schemes_query = db.query(Scheme)
    if scheme_id:
        schemes_query = schemes_query.filter(Scheme.id == scheme_id)
    schemes_list = schemes_query.all()

    deficient_states = set()
    for s in schemes_list:
        try:
            cfg = validate_scheme_config(s.config)
            for t in cfg.workflow_transitions:
                if "deficient" in t.trigger.lower() or "deficient" in t.to_state.lower():
                    deficient_states.add(t.to_state)
            for ws in cfg.workflow_states:
                if "deficient" in ws.name.lower():
                    deficient_states.add(ws.name)
        except Exception:
            pass

    if not deficient_states:
        deficient_states = {"deficient"}

    app_id_filter = [Application.current_state.in_(deficient_states)]
    if scheme_id:
        app_id_filter.append(Application.scheme_id == scheme_id)

    apps_in_deficient_state = set(
        r[0] for r in db.query(Application.id).filter(*app_id_filter).all()
    )

    doc_deficient_query = (
        db.query(Document.application_id)
        .join(Application, Application.id == Document.application_id)
        .filter(Document.status.in_([DocumentStatus.DEFICIENT, "DEFICIENT"]))
    )
    if scheme_id:
        doc_deficient_query = doc_deficient_query.filter(Application.scheme_id == scheme_id)
    apps_with_deficient_docs = set(r[0] for r in doc_deficient_query.distinct().all())

    deficient_count = len(apps_in_deficient_state | apps_with_deficient_docs)

    # 5. Documents by status
    documents_by_status = {"PENDING": 0, "VERIFIED": 0, "DEFICIENT": 0}
    doc_query = db.query(Document.status, func.count(Document.id))
    if scheme_id:
        doc_query = doc_query.join(Application, Application.id == Document.application_id).filter(
            Application.scheme_id == scheme_id
        )
    for st, count in doc_query.group_by(Document.status).all():
        key = st.value if hasattr(st, "value") else str(st)
        documents_by_status[key] = count

    # 6. Disbursements metrics
    disb_query = db.query(Disbursement)
    if scheme_id:
        disb_query = disb_query.join(Application, Application.id == Disbursement.application_id).filter(
            Application.scheme_id == scheme_id
        )
    pending_disbursements_count = disb_query.filter(
        Disbursement.status.in_([DisbursementStatus.PENDING, "PENDING"])
    ).count()

    total_disbursed_res = (
        disb_query.filter(Disbursement.status.in_([DisbursementStatus.DISBURSED, "DISBURSED"]))
        .with_entities(func.sum(Disbursement.amount))
        .scalar()
    )
    total_disbursed_amount = float(total_disbursed_res) if total_disbursed_res is not None else 0.0

    # 7. Pending renewals count
    ren_query = db.query(Renewal)
    if scheme_id:
        ren_query = ren_query.join(Application, Application.id == Renewal.application_id).filter(
            Application.scheme_id == scheme_id
        )
    pending_renewals_count = ren_query.filter(
        Renewal.status.in_([RenewalStatus.PENDING_REVIEW, "PENDING_REVIEW"])
    ).count()

    # 8. Recent activity (top 10 most recent AuditLog entries)
    audit_query = db.query(AuditLog)
    if scheme_id:
        audit_query = audit_query.filter(
            (AuditLog.scheme_id == scheme_id)
            | (
                AuditLog.application_id.in_(
                    db.query(Application.id).filter(Application.scheme_id == scheme_id)
                )
            )
        )
    recent_logs = audit_query.order_by(AuditLog.created_at.desc()).limit(10).all()
    recent_activity = [
        RecentActivityItem(
            id=log.id,
            action=log.action,
            application_id=log.application_id,
            created_at=log.created_at,
        )
        for log in recent_logs
    ]

    res = {
        "total_applications": total_applications,
        "applications_by_state": applications_by_state,
        "applications_by_scheme": applications_by_scheme,
        "deficient_count": deficient_count,
        "documents_by_status": documents_by_status,
        "pending_disbursements_count": pending_disbursements_count,
        "total_disbursed_amount": total_disbursed_amount,
        "pending_renewals_count": pending_renewals_count,
        "recent_activity": recent_activity,
    }
    cache.set(cache_key, res, ttl=10)
    return res


@router.get(
    "/overview",
    response_model=StatsOverview,
)
def get_stats_overview(
    current_user: Annotated[User, Depends(require_any_role)],
    db: Session = Depends(get_db),
) -> StatsOverview:
    """
    Retrieve platform-wide aggregate statistics across all schemes, applications,
    documents, disbursements, and renewals.
    Accessible to any authenticated role.
    """
    stats_data = _compute_stats(db=db, scheme_id=None)
    return StatsOverview(**stats_data)


@router.get(
    "/schemes/{scheme_id}",
    response_model=StatsOverview,
)
def get_scheme_stats(
    scheme_id: uuid.UUID,
    current_user: Annotated[User, Depends(require_any_role)],
    db: Session = Depends(get_db),
) -> StatsOverview:
    """
    Retrieve statistics scoped to a specific scheme.
    Accessible to any authenticated role.
    """
    scheme = db.query(Scheme).filter(Scheme.id == scheme_id).first()
    if not scheme:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Scheme {scheme_id} not found",
        )

    stats_data = _compute_stats(db=db, scheme_id=scheme_id)
    return StatsOverview(**stats_data)
