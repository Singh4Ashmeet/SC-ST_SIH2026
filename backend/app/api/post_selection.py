"""
Post-selection composite API router.

Endpoints for aggregated post-selection summary (disbursements and renewals).
"""

from typing import Annotated, List
import uuid

from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel, ConfigDict
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.core.deps import require_any_role
from app.models.application import Application
from app.models.disbursement import Disbursement
from app.models.renewal import Renewal
from app.models.user import User
from app.schemas.disbursement import DisbursementRead
from app.schemas.renewal import RenewalRead

router = APIRouter(prefix="/applications", tags=["Post-Selection"])


class PostSelectionSummary(BaseModel):
    """Aggregate response model containing disbursement history and renewal status."""
    application_id: uuid.UUID
    disbursements: List[DisbursementRead]
    renewals: List[RenewalRead]

    model_config = ConfigDict(from_attributes=True)


@router.get(
    "/{id}/post-selection-summary",
    response_model=PostSelectionSummary,
)
def get_post_selection_summary(
    id: uuid.UUID,
    current_user: Annotated[User, Depends(require_any_role)],
    db: Session = Depends(get_db),
) -> dict:
    """
    Retrieve composite post-selection tracking summary including all disbursements
    and renewals for an application.
    Accessible to any authenticated role.
    """
    application = db.query(Application).filter(Application.id == id).first()
    if not application:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Application {id} not found",
        )

    disbursements = (
        db.query(Disbursement)
        .filter(Disbursement.application_id == id)
        .order_by(Disbursement.installment_number.asc(), Disbursement.created_at.asc())
        .all()
    )

    renewals = (
        db.query(Renewal)
        .filter(Renewal.application_id == id)
        .order_by(Renewal.due_date.desc(), Renewal.created_at.desc())
        .all()
    )

    return {
        "application_id": application.id,
        "disbursements": disbursements,
        "renewals": renewals,
    }
