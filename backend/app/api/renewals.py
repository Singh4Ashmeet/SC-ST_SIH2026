"""
Renewals API router for applications.

Endpoints for creating and listing renewals for an application.
"""

from typing import Annotated, List
import uuid

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.core.deps import require_any_role, require_selection_committee
from app.models.application import Application
from app.models.audit_log import AuditLog
from app.models.renewal import Renewal, RenewalStatus
from app.models.user import User
from app.schemas.renewal import RenewalCreate, RenewalRead
from app.services.notification_service import notification_service, NotificationEvent

router = APIRouter(prefix="/applications", tags=["Renewals"])


@router.post(
    "/{id}/renewals",
    response_model=RenewalRead,
    status_code=status.HTTP_201_CREATED,
)
def create_renewal(
    id: uuid.UUID,
    payload: RenewalCreate,
    current_user: Annotated[User, Depends(require_selection_committee)],
    db: Session = Depends(get_db),
) -> Renewal:
    """
    Create a new renewal cycle for an application.
    Requires SUPER_ADMIN or SELECTION_COMMITTEE role.
    """
    application = db.query(Application).filter(Application.id == id).first()
    if not application:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Application {id} not found",
        )

    renewal = Renewal(
        application_id=application.id,
        academic_year_or_cycle=payload.academic_year_or_cycle,
        status=RenewalStatus.PENDING_REVIEW,
        due_date=payload.due_date,
        remarks=payload.remarks,
    )
    db.add(renewal)
    db.flush()

    from app.services.audit_service import create_audit_log
    create_audit_log(
        db=db,
        application_id=application.id,
        scheme_id=application.scheme_id,
        actor_user_id=current_user.id,
        action="renewal_created",
        from_state=None,
        to_state=RenewalStatus.PENDING_REVIEW.value,
        details={
            "renewal_id": str(renewal.id),
            "academic_year_or_cycle": renewal.academic_year_or_cycle,
            "due_date": str(renewal.due_date),
            "remarks": renewal.remarks,
        },
    )
    db.commit()
    db.refresh(renewal)

    notification_service.notify(
        NotificationEvent.RENEWAL_DUE,
        application,
        {
            "renewal_id": str(renewal.id),
            "academic_year_or_cycle": renewal.academic_year_or_cycle,
            "due_date": str(renewal.due_date),
        },
    )

    return renewal


@router.get(
    "/{id}/renewals",
    response_model=List[RenewalRead],
)
def list_renewals(
    id: uuid.UUID,
    current_user: Annotated[User, Depends(require_any_role)],
    db: Session = Depends(get_db),
) -> List[Renewal]:
    """
    List all renewal cycles for an application.
    Accessible to any authenticated role.
    """
    application = db.query(Application).filter(Application.id == id).first()
    if not application:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Application {id} not found",
        )

    return (
        db.query(Renewal)
        .filter(Renewal.application_id == id)
        .order_by(Renewal.due_date.desc(), Renewal.created_at.desc())
        .all()
    )
