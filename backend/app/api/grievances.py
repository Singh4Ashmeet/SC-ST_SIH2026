"""
Grievance Management API routes.

Provides CRUD for grievances with SLA tracking and escalation.
"""

from typing import Annotated, Any, Dict, List, Optional
from uuid import UUID
from datetime import datetime, timezone, timedelta

from fastapi import APIRouter, Body, Depends, HTTPException, Query, status
from sqlalchemy import select, func
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.core.deps import get_current_user, require_any_role, get_optional_current_user
from app.models.grievance import Grievance, GrievanceStatus, GrievancePriority
from app.models.user import User

router = APIRouter(prefix="/grievances", tags=["Grievances"])


# SLA defaults by priority
SLA_DEFAULTS = {
    GrievancePriority.LOW: 72,
    GrievancePriority.NORMAL: 48,
    GrievancePriority.HIGH: 24,
    GrievancePriority.CRITICAL: 8,
}


@router.post("", status_code=status.HTTP_201_CREATED)
def create_grievance(
    body: Dict[str, Any] = Body(...),
    current_user: Optional[User] = Depends(get_optional_current_user),
    db: Session = Depends(get_db),
) -> Dict[str, Any]:
    """
    Submit a grievance. Accessible by both authenticated and unauthenticated users.

    Body:
      - applicant_name: str (required)
      - applicant_email: str (required)
      - application_id: str (optional)
      - category: str (optional, default "general")
      - description: str (required)
      - priority: str (optional, default "NORMAL")
    """
    required = ["applicant_name", "applicant_email", "description"]
    for field in required:
        if not body.get(field):
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"'{field}' is required",
            )

    priority_str = body.get("priority", "NORMAL")
    try:
        priority = GrievancePriority(priority_str)
    except ValueError:
        priority = GrievancePriority.NORMAL

    sla_hours = SLA_DEFAULTS.get(priority, 48)
    now = datetime.now(timezone.utc)

    grievance = Grievance(
        application_id=body.get("application_id"),
        applicant_name=body["applicant_name"],
        applicant_email=body["applicant_email"],
        category=body.get("category", "general"),
        description=body["description"],
        priority=priority,
        status=GrievanceStatus.OPEN,
        sla_hours=sla_hours,
        due_at=now + timedelta(hours=sla_hours),
    )
    db.add(grievance)
    db.commit()
    db.refresh(grievance)

    return {
        "id": str(grievance.id),
        "status": grievance.status.value,
        "priority": grievance.priority.value,
        "sla_hours": grievance.sla_hours,
        "due_at": grievance.due_at.isoformat() if grievance.due_at else None,
        "created_at": grievance.created_at.isoformat(),
    }


@router.get("")
def list_grievances(
    current_user: Annotated[User, Depends(require_any_role)],
    status_filter: Optional[str] = Query(None),
    priority_filter: Optional[str] = Query(None),
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100),
    db: Session = Depends(get_db),
) -> Dict[str, Any]:
    """
    List grievances with optional filters. Requires admin role.
    """
    query = select(Grievance)

    if status_filter:
        try:
            gs = GrievanceStatus(status_filter)
            query = query.where(Grievance.status == gs)
        except ValueError:
            pass

    if priority_filter:
        try:
            gp = GrievancePriority(priority_filter)
            query = query.where(Grievance.priority == gp)
        except ValueError:
            pass

    # Count total
    count_query = select(func.count()).select_from(query.subquery())
    total = db.execute(count_query).scalar() or 0

    query = query.order_by(Grievance.created_at.desc())
    query = query.offset((page - 1) * page_size).limit(page_size)
    grievances = db.execute(query).scalars().all()

    now = datetime.now(timezone.utc)

    return {
        "total": total,
        "page": page,
        "page_size": page_size,
        "items": [
            {
                "id": str(g.id),
                "application_id": str(g.application_id) if g.application_id else None,
                "applicant_name": g.applicant_name,
                "applicant_email": g.applicant_email,
                "category": g.category,
                "description": g.description,
                "priority": g.priority.value,
                "status": g.status.value,
                "sla_hours": g.sla_hours,
                "due_at": g.due_at.isoformat() if g.due_at else None,
                "is_breached": g.due_at < now if g.due_at and g.status not in (GrievanceStatus.RESOLVED, GrievanceStatus.CLOSED) else False,
                "escalation_level": g.escalation_level,
                "created_at": g.created_at.isoformat(),
            }
            for g in grievances
        ],
    }


@router.get("/{grievance_id}")
def get_grievance(
    grievance_id: UUID,
    current_user: Annotated[User, Depends(require_any_role)],
    db: Session = Depends(get_db),
) -> Dict[str, Any]:
    """Get grievance details."""
    g = db.execute(
        select(Grievance).where(Grievance.id == grievance_id)
    ).scalar_one_or_none()

    if not g:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Grievance not found",
        )

    now = datetime.now(timezone.utc)

    return {
        "id": str(g.id),
        "application_id": str(g.application_id) if g.application_id else None,
        "applicant_name": g.applicant_name,
        "applicant_email": g.applicant_email,
        "category": g.category,
        "description": g.description,
        "priority": g.priority.value,
        "status": g.status.value,
        "assigned_role": g.assigned_role,
        "resolution": g.resolution,
        "sla_hours": g.sla_hours,
        "due_at": g.due_at.isoformat() if g.due_at else None,
        "is_breached": g.due_at < now if g.due_at and g.status not in (GrievanceStatus.RESOLVED, GrievanceStatus.CLOSED) else False,
        "escalation_level": g.escalation_level,
        "resolved_at": g.resolved_at.isoformat() if g.resolved_at else None,
        "created_at": g.created_at.isoformat(),
        "updated_at": g.updated_at.isoformat(),
    }


@router.patch("/{grievance_id}")
def update_grievance(
    grievance_id: UUID,
    current_user: Annotated[User, Depends(require_any_role)],
    body: Dict[str, Any] = Body(...),
    db: Session = Depends(get_db),
) -> Dict[str, Any]:
    """
    Update grievance status, assignment, or resolution. Requires admin role.

    Body can contain:
      - status: str (ASSIGNED, IN_PROGRESS, AWAITING_APPLICANT, RESOLVED, CLOSED, ESCALATED)
      - resolution: str
      - assigned_role: str
    """
    g = db.execute(
        select(Grievance).where(Grievance.id == grievance_id)
    ).scalar_one_or_none()

    if not g:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Grievance not found",
        )

    if "status" in body:
        try:
            new_status = GrievanceStatus(body["status"])
            g.status = new_status
            if new_status == GrievanceStatus.RESOLVED:
                g.resolved_at = datetime.now(timezone.utc)
            elif new_status == GrievanceStatus.ESCALATED:
                g.escalation_level += 1
            elif new_status == GrievanceStatus.ASSIGNED:
                g.assigned_user_id = current_user.id
        except ValueError:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Invalid status: {body['status']}",
            )

    if "resolution" in body:
        g.resolution = body["resolution"]
    if "assigned_role" in body:
        g.assigned_role = body["assigned_role"]

    db.commit()
    db.refresh(g)

    return {
        "id": str(g.id),
        "status": g.status.value,
        "resolution": g.resolution,
        "escalation_level": g.escalation_level,
    }


@router.get("/stats/overview")
def grievance_stats(
    current_user: Annotated[User, Depends(require_any_role)],
    db: Session = Depends(get_db),
) -> Dict[str, Any]:
    """Get grievance statistics overview."""
    now = datetime.now(timezone.utc)

    total = db.execute(select(func.count(Grievance.id))).scalar() or 0
    open_count = db.execute(
        select(func.count(Grievance.id)).where(
            Grievance.status.in_([GrievanceStatus.OPEN, GrievanceStatus.ASSIGNED, GrievanceStatus.IN_PROGRESS])
        )
    ).scalar() or 0
    breached = db.execute(
        select(func.count(Grievance.id)).where(
            Grievance.due_at < now,
            Grievance.status.not_in([GrievanceStatus.RESOLVED, GrievanceStatus.CLOSED]),
        )
    ).scalar() or 0
    resolved = db.execute(
        select(func.count(Grievance.id)).where(Grievance.status == GrievanceStatus.RESOLVED)
    ).scalar() or 0

    return {
        "total": total,
        "open": open_count,
        "breached": breached,
        "resolved": resolved,
        "resolution_rate": round(resolved / total * 100, 1) if total > 0 else 0,
    }
