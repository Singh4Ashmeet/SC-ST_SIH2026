"""
Communication Center API router for Yojana Setu (SIH26239).

Provides:
- In-app notification feed for applicants
- Multi-channel notification audit history for officials
- Application-specific communication timeline
- Manual/automated notification dispatching
"""

import logging
from typing import Annotated, Any, Dict, List, Optional
import uuid
from datetime import datetime

from fastapi import APIRouter, Depends, HTTPException, Query, status
from pydantic import BaseModel, EmailStr
from sqlalchemy import desc, select
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.core.deps import get_current_user, require_any_role
from app.core.authorization import verify_applicant_ownership_or_permission
from app.core.permissions import Permission, has_permission
from app.models.application import Application
from app.models.notification import Notification, NotificationChannel, DeliveryStatus
from app.models.user import User, UserRole
from app.services.notification_service import notification_service, NotificationEvent

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/notifications", tags=["Communication Center"])


class NotificationRead(BaseModel):
    id: uuid.UUID
    application_id: Optional[uuid.UUID] = None
    recipient_email: str
    recipient_name: Optional[str] = None
    event: str
    channel: str
    subject: Optional[str] = None
    message: str
    delivery_status: str
    created_at: datetime
    metadata: Optional[Dict[str, Any]] = None

    class Config:
        from_attributes = True


class DispatchNotificationRequest(BaseModel):
    application_id: uuid.UUID
    event: NotificationEvent
    channels: Optional[List[NotificationChannel]] = None
    subject_override: Optional[str] = None
    message_override: Optional[str] = None
    extra: Optional[Dict[str, Any]] = None


@router.get("", response_model=List[NotificationRead])
def list_notifications(
    channel: Optional[NotificationChannel] = Query(None, description="Filter by channel: PORTAL, EMAIL, SMS"),
    event: Optional[str] = Query(None, description="Filter by event name"),
    delivery_status: Optional[DeliveryStatus] = Query(None, description="Filter by delivery status"),
    page: int = Query(1, ge=1),
    page_size: int = Query(50, ge=1, le=200),
    current_user: Annotated[User, Depends(require_any_role)] = None,
    db: Session = Depends(get_db),
) -> List[Notification]:
    """
    List notifications.
    Applicants can ONLY see notifications addressed to their verified email.
    Administrative officials can query all communication history across channels.
    """
    query = db.query(Notification)

    # Scoping for applicants
    if current_user.role == UserRole.APPLICANT:
        query = query.filter(Notification.recipient_email.ilike(current_user.email))
    
    if channel:
        query = query.filter(Notification.channel == channel)
    if event:
        query = query.filter(Notification.event == event)
    if delivery_status:
        query = query.filter(Notification.delivery_status == delivery_status)

    offset = (page - 1) * page_size
    return query.order_by(desc(Notification.created_at)).offset(offset).limit(page_size).all()


@router.get("/application/{application_id}", response_model=List[NotificationRead])
def get_application_communication_history(
    application_id: uuid.UUID,
    current_user: Annotated[User, Depends(require_any_role)] = None,
    db: Session = Depends(get_db),
) -> List[Notification]:
    """
    Retrieve complete multi-channel communication history for a specific application.
    Enforces applicant ownership verification.
    """
    application = db.query(Application).filter(Application.id == application_id).first()
    if not application:
        raise HTTPException(status_code=404, detail="Application not found")

    verify_applicant_ownership_or_permission(
        user=current_user,
        application=application,
        required_permission=Permission.APPLICATION_VIEW,
    )

    return (
        db.query(Notification)
        .filter(Notification.application_id == application_id)
        .order_by(desc(Notification.created_at))
        .all()
    )


@router.post("/dispatch", status_code=status.HTTP_201_CREATED)
def dispatch_notification(
    payload: DispatchNotificationRequest,
    current_user: Annotated[User, Depends(require_any_role)] = None,
    db: Session = Depends(get_db),
) -> Dict[str, Any]:
    """
    Dispatch a notification for an application across specified channels.
    Requires official authorization.
    """
    if current_user.role == UserRole.APPLICANT:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Applicants cannot dispatch administrative notifications",
        )

    application = db.query(Application).filter(Application.id == payload.application_id).first()
    if not application:
        raise HTTPException(status_code=404, detail="Application not found")

    notification_service.notify(
        event=payload.event,
        application=application,
        extra=payload.extra or {},
        db=db,
        channels=payload.channels,
    )

    return {
        "status": "DISPATCHED",
        "application_id": str(application.id),
        "event": payload.event.value,
        "recipient": application.applicant_email,
        "dispatched_at": datetime.utcnow().isoformat() + "Z",
    }
