"""
Merit Engine API routes.

Provides endpoints for merit evaluation, ranking, and score retrieval.
"""

from typing import Annotated, Any, Dict, List, Optional
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.core.deps import get_current_user, require_selection_committee, require_scheme_admin
from app.models.application import Application
from app.models.audit_log import AuditLog
from app.models.merit_evaluation import MeritEvaluation
from app.models.scheme import Scheme
from app.models.user import User
from app.schemas.scheme_config import SchemeConfig
from app.services.merit_engine import (
    compute_merit_score,
    evaluate_and_rank_scheme,
    MeritEngineError,
)

router = APIRouter(prefix="/merit", tags=["Merit Engine"])


@router.post("/schemes/{scheme_id}/evaluate")
def run_merit_evaluation(
    scheme_id: UUID,
    current_user: Annotated[User, Depends(require_selection_committee)],
    db: Session = Depends(get_db),
) -> Dict[str, Any]:
    """
    Run merit evaluation and ranking for all eligible applications in a scheme.

    Requires SELECTION_COMMITTEE or SUPER_ADMIN role.
    """
    try:
        evaluations = evaluate_and_rank_scheme(
            db=db,
            scheme_id=scheme_id,
            evaluator_id=current_user.id,
        )
    except MeritEngineError as exc:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail=str(exc),
        ) from exc

    # Create audit log
    audit = AuditLog(
        scheme_id=scheme_id,
        actor_user_id=current_user.id,
        action="merit_evaluation_run",
        details={
            "applications_ranked": len(evaluations),
            "top_score": evaluations[0].total_score if evaluations else 0,
        },
    )
    db.add(audit)
    db.commit()

    return {
        "scheme_id": str(scheme_id),
        "applications_ranked": len(evaluations),
        "rankings": [
            {
                "rank": ev.rank,
                "application_id": str(ev.application_id),
                "total_score": ev.total_score,
                "score_breakdown": ev.score_breakdown,
                "preference_factors": ev.preference_factors,
            }
            for ev in evaluations
        ],
    }


@router.get("/schemes/{scheme_id}/rankings")
def get_merit_rankings(
    scheme_id: UUID,
    current_user: Annotated[User, Depends(get_current_user)],
    db: Session = Depends(get_db),
) -> Dict[str, Any]:
    """
    Get the latest merit rankings for a scheme.
    """
    evaluations = db.execute(
        select(MeritEvaluation)
        .where(MeritEvaluation.scheme_id == scheme_id)
        .order_by(MeritEvaluation.rank)
    ).scalars().all()

    return {
        "scheme_id": str(scheme_id),
        "total_ranked": len(evaluations),
        "rankings": [
            {
                "rank": ev.rank,
                "application_id": str(ev.application_id),
                "total_score": ev.total_score,
                "score_breakdown": ev.score_breakdown,
                "preference_factors": ev.preference_factors,
                "evaluated_at": ev.evaluated_at.isoformat() if ev.evaluated_at else None,
            }
            for ev in evaluations
        ],
    }


@router.get("/applications/{application_id}/score")
def get_application_merit_score(
    application_id: UUID,
    current_user: Annotated[User, Depends(get_current_user)],
    db: Session = Depends(get_db),
) -> Dict[str, Any]:
    """
    Get the merit score for a specific application (latest evaluation).
    """
    evaluation = db.execute(
        select(MeritEvaluation)
        .where(MeritEvaluation.application_id == application_id)
        .order_by(MeritEvaluation.evaluated_at.desc())
    ).scalars().first()

    if not evaluation:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="No merit evaluation found for this application",
        )

    return {
        "application_id": str(application_id),
        "rank": evaluation.rank,
        "total_score": evaluation.total_score,
        "score_breakdown": evaluation.score_breakdown,
        "preference_factors": evaluation.preference_factors,
        "scheme_config_version": evaluation.scheme_config_version,
        "evaluated_at": evaluation.evaluated_at.isoformat(),
    }


@router.post("/applications/{application_id}/preview")
def preview_merit_score(
    application_id: UUID,
    current_user: Annotated[User, Depends(get_current_user)],
    db: Session = Depends(get_db),
) -> Dict[str, Any]:
    """
    Preview (dry-run) the merit score for a single application without persisting.
    """
    application = db.execute(
        select(Application).where(Application.id == application_id)
    ).scalar_one_or_none()

    if not application:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Application not found",
        )

    scheme = db.execute(
        select(Scheme).where(Scheme.id == application.scheme_id)
    ).scalar_one_or_none()

    if not scheme:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Scheme not found",
        )

    config = SchemeConfig(**scheme.config)

    result = compute_merit_score(
        applicant_data=application.applicant_data or {},
        criteria=config.merit_criteria,
        preference_rules=config.preference_rules,
    )

    return {
        "application_id": str(application_id),
        "applicant_name": application.applicant_name,
        "preview": True,
        **result,
    }
