"""
Renewals CRUD API router.

Endpoints for reviewing and updating renewal records.
"""

from datetime import date
from typing import Annotated
import uuid

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.core.deps import require_selection_committee
from app.models.application import Application
from app.models.audit_log import AuditLog
from app.models.renewal import Renewal
from app.models.user import User
from app.schemas.renewal import RenewalRead, RenewalUpdate

router = APIRouter(prefix="/renewals", tags=["Renewals"])


@router.patch(
    "/{id}",
    response_model=RenewalRead,
)
def update_renewal(
    id: uuid.UUID,
    payload: RenewalUpdate,
    current_user: Annotated[User, Depends(require_selection_committee)],
    db: Session = Depends(get_db),
) -> Renewal:
    """
    Approve, reject, or update a renewal cycle with reviewer remarks.
    Sets reviewer_id to the authenticated user and reviewed_date to today.
    Requires SUPER_ADMIN or SELECTION_COMMITTEE role.
    """
    renewal = db.query(Renewal).filter(Renewal.id == id).first()
    if not renewal:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Renewal {id} not found",
        )

    old_status = renewal.status.value
    renewal.status = payload.status
    renewal.reviewer_id = current_user.id
    renewal.reviewed_date = date.today()

    if payload.remarks is not None:
        renewal.remarks = payload.remarks

    app_obj = db.query(Application).filter(Application.id == renewal.application_id).first()
    scheme_id = app_obj.scheme_id if app_obj else None

    from app.services.audit_service import create_audit_log
    create_audit_log(
        db=db,
        application_id=renewal.application_id,
        scheme_id=scheme_id,
        actor_user_id=current_user.id,
        action="renewal_updated",
        from_state=old_status,
        to_state=payload.status.value,
        details={
            "renewal_id": str(renewal.id),
            "old_status": old_status,
            "new_status": payload.status.value,
            "reviewer_id": str(current_user.id),
            "reviewed_date": str(renewal.reviewed_date),
            "remarks": renewal.remarks,
        },
    )
    db.commit()
    db.refresh(renewal)
    return renewal
