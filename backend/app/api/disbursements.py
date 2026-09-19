"""
Disbursements API router for applications.

Endpoints for creating and listing disbursements for an application.
"""

from datetime import date
from typing import Annotated, List, Set
import uuid

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.core.deps import require_any_role, require_selection_committee
from app.models.application import Application
from app.models.audit_log import AuditLog
from app.models.disbursement import Disbursement, DisbursementStatus
from app.models.scheme import Scheme
from app.models.user import User
from app.schemas.disbursement import DisbursementCreate, DisbursementRead
from app.services.scheme_config_validator import validate_scheme_config

router = APIRouter(prefix="/applications", tags=["Disbursements"])


def get_approved_states(scheme: Scheme) -> Set[str]:
    """
    Determine the set of approved/awarded states for a scheme.
    Inspects workflow transitions for selection committee approval triggers,
    and includes all reachable downstream states (excluding terminal rejection states).
    """
    config = validate_scheme_config(scheme.config)

    target_states: Set[str] = set()
    for t in config.workflow_transitions:
        allowed = {r.upper() for r in t.allowed_roles}
        to_lower = t.to_state.lower()
        trigger_lower = t.trigger.lower()

        # Transitions where SELECTION_COMMITTEE is authorized or trigger is committee approval
        if (
            "SELECTION_COMMITTEE" in allowed or "approv" in trigger_lower
        ) and "reject" not in to_lower and "cancel" not in to_lower:
            target_states.add(t.to_state)

    if not target_states:
        for s in config.workflow_states:
            s_name = s.name.lower()
            if ("approv" in s_name or "award" in s_name) and "reject" not in s_name:
                target_states.add(s.name)

    reachable: Set[str] = set(target_states)
    queue = list(target_states)
    visited: Set[str] = set(target_states)
    while queue:
        curr = queue.pop(0)
        for t in config.workflow_transitions:
            if t.from_state == curr and t.to_state not in visited:
                if "reject" not in t.to_state.lower() and "cancel" not in t.to_state.lower():
                    visited.add(t.to_state)
                    reachable.add(t.to_state)
                    queue.append(t.to_state)

    return reachable


@router.post(
    "/{id}/disbursements",
    response_model=DisbursementRead,
    status_code=status.HTTP_201_CREATED,
)
def create_disbursement(
    id: uuid.UUID,
    payload: DisbursementCreate,
    current_user: Annotated[User, Depends(require_selection_committee)],
    db: Session = Depends(get_db),
) -> Disbursement:
    """
    Create a new disbursement record for an application.
    Requires SUPER_ADMIN or SELECTION_COMMITTEE role.
    Validates that the application has reached an approved state.
    """
    application = db.query(Application).filter(Application.id == id).first()
    if not application:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Application {id} not found",
        )

    scheme = db.query(Scheme).filter(Scheme.id == application.scheme_id).first()
    if not scheme:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Scheme not found for this application",
        )

    approved_states = get_approved_states(scheme)
    if application.current_state not in approved_states:
        sorted_allowed = sorted(list(approved_states))
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=(
                f"Disbursement cannot be created: Application is currently in '{application.current_state}'. "
                f"Application must be in an approved state ({', '.join(sorted_allowed)})."
            ),
        )

    disbursement = Disbursement(
        application_id=application.id,
        amount=payload.amount,
        status=DisbursementStatus.PENDING,
        installment_number=payload.installment_number,
        remarks=payload.remarks,
        created_by=current_user.id,
    )
    db.add(disbursement)
    db.flush()

    audit_log = AuditLog(
        application_id=application.id,
        scheme_id=application.scheme_id,
        actor_user_id=current_user.id,
        action="disbursement_created",
        from_state=None,
        to_state=DisbursementStatus.PENDING.value,
        details={
            "disbursement_id": str(disbursement.id),
            "amount": float(disbursement.amount),
            "installment_number": disbursement.installment_number,
            "remarks": disbursement.remarks,
        },
    )
    db.add(audit_log)
    db.commit()
    db.refresh(disbursement)
    return disbursement


@router.get(
    "/{id}/disbursements",
    response_model=List[DisbursementRead],
)
def list_disbursements(
    id: uuid.UUID,
    current_user: Annotated[User, Depends(require_any_role)],
    db: Session = Depends(get_db),
) -> List[Disbursement]:
    """
    List all disbursements for an application.
    Accessible to any authenticated role.
    """
    application = db.query(Application).filter(Application.id == id).first()
    if not application:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Application {id} not found",
        )

    return (
        db.query(Disbursement)
        .filter(Disbursement.application_id == id)
        .order_by(Disbursement.installment_number.asc(), Disbursement.created_at.asc())
        .all()
    )
