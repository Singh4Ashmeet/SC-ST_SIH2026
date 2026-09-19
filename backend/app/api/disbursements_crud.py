"""
Disbursements CRUD API router.

Endpoints for updating disbursement records.
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
from app.models.disbursement import Disbursement, DisbursementStatus
from app.models.user import User
from app.schemas.disbursement import DisbursementRead, DisbursementUpdate
from app.services.notification_service import notification_service, NotificationEvent

router = APIRouter(prefix="/disbursements", tags=["Disbursements"])


@router.patch(
    "/{id}",
    response_model=DisbursementRead,
)
def update_disbursement(
    id: uuid.UUID,
    payload: DisbursementUpdate,
    current_user: Annotated[User, Depends(require_selection_committee)],
    db: Session = Depends(get_db),
) -> Disbursement:
    """
    Update disbursement status, remarks, or disbursement date.
    If status is changed to DISBURSED and disbursed_date is not provided,
    disbursed_date automatically defaults to today.
    Requires SUPER_ADMIN or SELECTION_COMMITTEE role.
    """
    disbursement = db.query(Disbursement).filter(Disbursement.id == id).first()
    if not disbursement:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Disbursement {id} not found",
        )

    old_status = disbursement.status.value
    disbursement.status = payload.status

    if payload.remarks is not None:
        disbursement.remarks = payload.remarks

    if payload.disbursed_date is not None:
        disbursement.disbursed_date = payload.disbursed_date
    elif payload.status == DisbursementStatus.DISBURSED and disbursement.disbursed_date is None:
        disbursement.disbursed_date = date.today()

    app_obj = db.query(Application).filter(Application.id == disbursement.application_id).first()
    scheme_id = app_obj.scheme_id if app_obj else None

    audit_log = AuditLog(
        application_id=disbursement.application_id,
        scheme_id=scheme_id,
        actor_user_id=current_user.id,
        action="disbursement_updated",
        from_state=old_status,
        to_state=payload.status.value,
        details={
            "disbursement_id": str(disbursement.id),
            "old_status": old_status,
            "new_status": payload.status.value,
            "disbursed_date": str(disbursement.disbursed_date) if disbursement.disbursed_date else None,
            "remarks": disbursement.remarks,
        },
    )
    db.add(audit_log)
    db.commit()
    db.refresh(disbursement)

    if payload.status == DisbursementStatus.DISBURSED and old_status != DisbursementStatus.DISBURSED.value:
        if app_obj:
            notification_service.notify(
                NotificationEvent.DISBURSEMENT_COMPLETED,
                app_obj,
                {
                    "disbursement_id": str(disbursement.id),
                    "amount": float(disbursement.amount),
                    "installment_number": disbursement.installment_number,
                },
            )

    return disbursement
