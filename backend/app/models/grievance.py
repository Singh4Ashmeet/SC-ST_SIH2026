"""
Grievance and SLA management models.
"""

import enum
import uuid
from datetime import datetime
from typing import Optional
from sqlalchemy import DateTime, Enum as SQLEnum, ForeignKey, Integer, String, Text, func
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.models.base import Base, UUIDMixin


class GrievanceStatus(str, enum.Enum):
    """Status of a grievance."""
    OPEN = "OPEN"
    ASSIGNED = "ASSIGNED"
    IN_PROGRESS = "IN_PROGRESS"
    AWAITING_APPLICANT = "AWAITING_APPLICANT"
    RESOLVED = "RESOLVED"
    CLOSED = "CLOSED"
    ESCALATED = "ESCALATED"


class GrievancePriority(str, enum.Enum):
    """Priority level of a grievance."""
    LOW = "LOW"
    NORMAL = "NORMAL"
    HIGH = "HIGH"
    CRITICAL = "CRITICAL"


class Grievance(Base, UUIDMixin):
    """Grievance submitted by an applicant."""
    __tablename__ = "grievances"

    application_id: Mapped[Optional[uuid.UUID]] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("applications.id", ondelete="SET NULL"),
        nullable=True,
        index=True,
    )
    applicant_name: Mapped[str] = mapped_column(
        String(255),
        nullable=False,
    )
    applicant_email: Mapped[str] = mapped_column(
        String(255),
        nullable=False,
    )
    category: Mapped[str] = mapped_column(
        String(100),
        nullable=False,
        default="general",
    )
    description: Mapped[str] = mapped_column(
        Text,
        nullable=False,
    )
    priority: Mapped[GrievancePriority] = mapped_column(
        SQLEnum(GrievancePriority, name="grievance_priority", native_enum=True),
        default=GrievancePriority.NORMAL,
        server_default=GrievancePriority.NORMAL.value,
        nullable=False,
    )
    status: Mapped[GrievanceStatus] = mapped_column(
        SQLEnum(GrievanceStatus, name="grievance_status", native_enum=True),
        default=GrievanceStatus.OPEN,
        server_default=GrievanceStatus.OPEN.value,
        nullable=False,
    )
    assigned_role: Mapped[Optional[str]] = mapped_column(
        String(50),
        nullable=True,
    )
    assigned_user_id: Mapped[Optional[uuid.UUID]] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("users.id", ondelete="SET NULL"),
        nullable=True,
    )
    resolution: Mapped[Optional[str]] = mapped_column(
        Text,
        nullable=True,
    )
    escalation_level: Mapped[int] = mapped_column(
        Integer,
        default=0,
        server_default="0",
        nullable=False,
    )
    sla_hours: Mapped[int] = mapped_column(
        Integer,
        default=48,
        server_default="48",
        nullable=False,
    )
    due_at: Mapped[Optional[datetime]] = mapped_column(
        DateTime(timezone=True),
        nullable=True,
    )
    resolved_at: Mapped[Optional[datetime]] = mapped_column(
        DateTime(timezone=True),
        nullable=True,
    )
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        server_default=func.now(),
        nullable=False,
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        server_default=func.now(),
        onupdate=func.now(),
        nullable=False,
    )

    # Relationships
    application = relationship("Application", backref="grievances")
    assigned_user = relationship("User")
