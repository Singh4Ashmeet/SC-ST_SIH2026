"""
Global Audit Log API router.

Provides a paginated, system-wide view of all audit trail entries.
"""

from typing import Annotated, Any, Dict, List, Optional

from fastapi import APIRouter, Depends, Query
from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.core.deps import require_any_role
from app.models.audit_log import AuditLog
from app.models.user import User

router = APIRouter(prefix="/audit-log", tags=["Audit Log"])


@router.get("")
def list_audit_logs(
    page: int = Query(1, ge=1, description="Page number"),
    page_size: int = Query(50, ge=1, le=200, description="Items per page"),
    application_id: Optional[str] = Query(None, description="Filter by application ID"),
    scheme_id: Optional[str] = Query(None, description="Filter by scheme ID"),
    current_user: Annotated[User, Depends(require_any_role)] = None,
    db: Session = Depends(get_db),
) -> Dict[str, Any]:
    """
    List all audit log entries across the system with pagination.

    Any authenticated role can access.
    Returns entries ordered by created_at DESC (newest first).
    """
    query = select(AuditLog)

    if application_id:
        query = query.where(AuditLog.application_id == application_id)
    if scheme_id:
        query = query.where(AuditLog.scheme_id == scheme_id)

    # Get total count
    count_query = select(func.count()).select_from(query.subquery())
    total = db.execute(count_query).scalar() or 0

    # Apply pagination
    offset = (page - 1) * page_size
    query = query.order_by(AuditLog.created_at.desc()).offset(offset).limit(page_size)
    logs = db.execute(query).scalars().all()

    return {
        "items": [
            {
                "id": str(log.id),
                "application_id": str(log.application_id) if log.application_id else None,
                "scheme_id": str(log.scheme_id) if log.scheme_id else None,
                "actor_user_id": str(log.actor_user_id) if log.actor_user_id else None,
                "action": log.action,
                "from_state": log.from_state,
                "to_state": log.to_state,
                "details": log.details,
                "created_at": log.created_at.isoformat() if log.created_at else None,
            }
            for log in logs
        ],
        "total": total,
        "page": page,
        "page_size": page_size,
    }
