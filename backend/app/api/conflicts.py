"""
Conflict Detection API routes.

Provides endpoints for detecting, reviewing, and resolving cross-scheme conflicts.
"""

from typing import Annotated, Any, Dict, List, Optional
from uuid import UUID

from fastapi import APIRouter, Body, Depends, HTTPException, Query, status
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.core.deps import get_current_user, require_any_role, require_scheme_admin
from app.models.audit_log import AuditLog
from app.models.conflict import Conflict, ConflictStatus
from app.models.user import User
from app.services.conflict_engine import detect_conflicts_for_application, get_conflict_summary

router = APIRouter(prefix="/conflicts", tags=["Conflict Detection"])


@router.post("/applications/{application_id}/detect")
def run_conflict_detection(
    application_id: UUID,
    current_user: Annotated[User, Depends(require_any_role)],
    threshold: float = Query(0.6, ge=0.0, le=1.0, description="Minimum match confidence"),
    db: Session = Depends(get_db),
) -> Dict[str, Any]:
    """
    Run conflict detection for a specific application.

    Requires any admin role.
    """
    new_conflicts = detect_conflicts_for_application(
        db=db,
        application_id=application_id,
        threshold=threshold,
    )

    # Audit log with cryptographic hash chain
    from app.services.audit_service import create_audit_log
    create_audit_log(
        db=db,
        application_id=application_id,
        actor_user_id=current_user.id,
        action="conflict_detection_run",
        details={
            "conflicts_found": len(new_conflicts),
            "threshold": threshold,
        },
    )
    db.commit()

    return {
        "application_id": str(application_id),
        "new_conflicts_detected": len(new_conflicts),
        "conflicts": [
            {
                "id": str(c.id),
                "conflicting_application_id": str(c.conflicting_application_id) if c.conflicting_application_id else None,
                "conflict_type": c.conflict_type.value,
                "confidence": c.confidence,
                "matching_signals": c.matching_signals,
                "status": c.status.value,
            }
            for c in new_conflicts
        ],
    }


@router.get("")
def list_conflicts(
    current_user: Annotated[User, Depends(require_any_role)],
    application_id: Optional[UUID] = Query(None),
    status_filter: Optional[str] = Query(None, description="Filter by status: PENDING_REVIEW, CONFIRMED, CLEARED, FALSE_POSITIVE"),
    db: Session = Depends(get_db),
) -> Dict[str, Any]:
    """
    List conflict records with optional filters.
    """
    query = select(Conflict)

    if application_id:
        query = query.where(
            (Conflict.application_id == application_id) |
            (Conflict.conflicting_application_id == application_id)
        )

    if status_filter:
        try:
            cs = ConflictStatus(status_filter)
            query = query.where(Conflict.status == cs)
        except ValueError:
            pass

    query = query.order_by(Conflict.created_at.desc())
    conflicts = db.execute(query).scalars().all()

    return {
        "total": len(conflicts),
        "conflicts": [
            {
                "id": str(c.id),
                "application_id": str(c.application_id),
                "conflicting_application_id": str(c.conflicting_application_id) if c.conflicting_application_id else None,
                "conflict_type": c.conflict_type.value,
                "confidence": c.confidence,
                "matching_signals": c.matching_signals,
                "status": c.status.value,
                "explanation": c.explanation,
                "created_at": c.created_at.isoformat(),
            }
            for c in conflicts
        ],
    }


@router.patch("/{conflict_id}/resolve")
def resolve_conflict(
    conflict_id: UUID,
    current_user: Annotated[User, Depends(require_scheme_admin)],
    body: Dict[str, Any] = Body(...),
    db: Session = Depends(get_db),
) -> Dict[str, Any]:
    """
    Resolve a conflict (human-in-the-loop review).

    Body should contain:
      - status: "CONFIRMED" | "CLEARED" | "FALSE_POSITIVE"
      - resolution_remarks: optional string
    """
    conflict = db.execute(
        select(Conflict).where(Conflict.id == conflict_id)
    ).scalar_one_or_none()

    if not conflict:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Conflict not found",
        )

    new_status_str = body.get("status")
    if not new_status_str:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="'status' field is required (CONFIRMED, CLEARED, or FALSE_POSITIVE)",
        )

    try:
        new_status = ConflictStatus(new_status_str)
    except ValueError:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Invalid status: {new_status_str}",
        )

    from datetime import datetime, timezone
    conflict.status = new_status
    conflict.resolved_by = current_user.id
    conflict.resolved_at = datetime.now(timezone.utc)
    conflict.resolution_remarks = body.get("resolution_remarks", "")

    # Audit log with cryptographic hash chain
    from app.services.audit_service import create_audit_log
    create_audit_log(
        db=db,
        application_id=conflict.primary_application_id if hasattr(conflict, "primary_application_id") else getattr(conflict, "application_id", None),
        actor_user_id=current_user.id,
        action="conflict_resolved",
        details={
            "conflict_id": str(conflict_id),
            "resolution": new_status.value,
            "remarks": conflict.resolution_remarks,
        },
    )
    db.commit()

    return {
        "conflict_id": str(conflict_id),
        "status": new_status.value,
        "resolved_by": str(current_user.id),
        "resolution_remarks": conflict.resolution_remarks,
    }
