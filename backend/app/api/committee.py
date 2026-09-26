"""
Committee Governance API router for Selection Committee integrity,
quorum tracking, individual votes, and conflict overrides.
"""

from typing import Annotated, Any, Dict, List, Optional
import uuid

from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.core.deps import get_current_user, require_any_role
from app.models.user import User, UserRole
from app.services.committee_integrity_service import (
    record_committee_review,
    get_committee_summary,
    override_committee_conflict,
)

router = APIRouter(prefix="/committee", tags=["Selection Committee"])


class VoteRequest(BaseModel):
    vote: str  # APPROVE, REJECT, ABSTAIN, HOLD
    score: Optional[float] = None
    comments: Optional[str] = None
    conflict_declared: bool = False
    conflict_reason: Optional[str] = None


class ConflictOverrideRequest(BaseModel):
    resolution_remarks: str


@router.get("/applications/{application_id}/summary")
def get_application_committee_summary(
    application_id: uuid.UUID,
    current_user: Annotated[User, Depends(require_any_role)],
    db: Session = Depends(get_db),
) -> Dict[str, Any]:
    """Get consolidated committee review summary, quorum status, and warnings."""
    if current_user.role == UserRole.APPLICANT:
        raise HTTPException(status_code=403, detail="Applicants cannot view committee deliberation details")

    try:
        return get_committee_summary(db, application_id)
    except Exception as exc:
        raise HTTPException(status_code=400, detail=str(exc))


@router.post("/applications/{application_id}/vote")
def cast_committee_vote(
    application_id: uuid.UUID,
    payload: VoteRequest,
    current_user: Annotated[User, Depends(require_any_role)],
    db: Session = Depends(get_db),
) -> Dict[str, Any]:
    """Cast an individual committee member vote, review score, or conflict declaration."""
    if current_user.role not in [UserRole.SELECTION_COMMITTEE, UserRole.SUPER_ADMIN, UserRole.SCHEME_ADMIN]:
        raise HTTPException(
            status_code=403,
            detail="Only Selection Committee members and Scheme Admins can record committee reviews",
        )

    try:
        return record_committee_review(
            db=db,
            application_id=application_id,
            committee_member=current_user,
            vote=payload.vote,
            score=payload.score,
            comments=payload.comments,
            conflict_declared=payload.conflict_declared,
            conflict_reason=payload.conflict_reason,
        )
    except ValueError as val_err:
        raise HTTPException(status_code=404, detail=str(val_err))
    except Exception as exc:
        raise HTTPException(status_code=400, detail=str(exc))


@router.post("/applications/{application_id}/override-conflict")
def administrative_conflict_override(
    application_id: uuid.UUID,
    payload: ConflictOverrideRequest,
    current_user: Annotated[User, Depends(require_any_role)],
    db: Session = Depends(get_db),
) -> Dict[str, Any]:
    """Authorized administrative override for declared conflict of interest."""
    try:
        return override_committee_conflict(
            db=db,
            application_id=application_id,
            override_user=current_user,
            resolution_remarks=payload.resolution_remarks,
        )
    except PermissionError as perm_err:
        raise HTTPException(status_code=403, detail=str(perm_err))
    except Exception as exc:
        raise HTTPException(status_code=400, detail=str(exc))
