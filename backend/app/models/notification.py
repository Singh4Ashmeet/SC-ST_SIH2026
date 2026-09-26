"""
Persistent notification model for tracking all notification events.
"""

import enum
import uuid
from datetime import datetime
from typing import Optional
from sqlalchemy import DateTime, Enum as SQLEnum, ForeignKey, String, Text, func
from sqlalchemy.dialects.postgresql import JSONB, UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.models.base import Base, UUIDMixin


class NotificationChannel(str, enum.Enum):
    """Delivery channel for notifications."""
    PORTAL = "PORTAL"
    EMAIL = "EMAIL"
    SMS = "SMS"


class DeliveryStatus(str, enum.Enum):
    """Delivery status of a notification."""
    PENDING = "PENDING"
    SENT = "SENT"
    DELIVERED = "DELIVERED"
    FAILED = "FAILED"
    SIMULATED = "SIMULATED"


class Notification(Base, UUIDMixin):
    """Persistent notification record."""
    __tablename__ = "notifications"

    application_id: Mapped[Optional[uuid.UUID]] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("applications.id", ondelete="SET NULL"),
        nullable=True,
        index=True,
    )
    recipient_email: Mapped[str] = mapped_column(
        String(255),
        nullable=False,
    )
    recipient_name: Mapped[Optional[str]] = mapped_column(
        String(255),
        nullable=True,
    )
    event: Mapped[str] = mapped_column(
        String(100),
        nullable=False,
        index=True,
    )
    channel: Mapped[NotificationChannel] = mapped_column(
        SQLEnum(NotificationChannel, name="notification_channel", native_enum=True),
        default=NotificationChannel.PORTAL,
        nullable=False,
    )
    subject: Mapped[Optional[str]] = mapped_column(
        String(500),
        nullable=True,
    )
    message: Mapped[str] = mapped_column(
        Text,
        nullable=False,
    )
    delivery_status: Mapped[DeliveryStatus] = mapped_column(
        SQLEnum(DeliveryStatus, name="delivery_status", native_enum=True),
        default=DeliveryStatus.SIMULATED,
        server_default=DeliveryStatus.SIMULATED.value,
        nullable=False,
    )
    extra_metadata: Mapped[Optional[dict]] = mapped_column(
        "metadata",
        JSONB,
        nullable=True,
    )
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        server_default=func.now(),
        nullable=False,
    )

    # Relationships
    application = relationship("Application", backref="notifications")
