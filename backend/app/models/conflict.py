"""
Cross-scheme conflict detection model.
"""

import enum
import uuid
from datetime import datetime
from typing import Any, Optional
from sqlalchemy import DateTime, Enum as SQLEnum, Float, ForeignKey, String, Text, func
from sqlalchemy.dialects.postgresql import JSONB, UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.models.base import Base, UUIDMixin


class ConflictStatus(str, enum.Enum):
    """Status of a detected conflict."""
    PENDING_REVIEW = "PENDING_REVIEW"
    CONFIRMED = "CONFIRMED"
    CLEARED = "CLEARED"
    FALSE_POSITIVE = "FALSE_POSITIVE"


class ConflictType(str, enum.Enum):
    """Type of cross-scheme conflict."""
    CONCURRENT_SCHOLARSHIP = "CONCURRENT_SCHOLARSHIP"
    DUPLICATE_APPLICATION = "DUPLICATE_APPLICATION"
    REPEATED_BENEFICIARY = "REPEATED_BENEFICIARY"
    CROSS_SCHEME_INCOMPATIBILITY = "CROSS_SCHEME_INCOMPATIBILITY"
    IDENTITY_COLLISION = "IDENTITY_COLLISION"


class Conflict(Base, UUIDMixin):
    """Cross-scheme beneficiary conflict record."""
    __tablename__ = "conflicts"

    application_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("applications.id", ondelete="CASCADE"),
        index=True,
        nullable=False,
    )
    conflicting_application_id: Mapped[Optional[uuid.UUID]] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("applications.id", ondelete="SET NULL"),
        nullable=True,
    )
    conflict_type: Mapped[ConflictType] = mapped_column(
        SQLEnum(ConflictType, name="conflict_type", native_enum=True),
        nullable=False,
    )
    status: Mapped[ConflictStatus] = mapped_column(
        SQLEnum(ConflictStatus, name="conflict_status", native_enum=True),
        default=ConflictStatus.PENDING_REVIEW,
        server_default=ConflictStatus.PENDING_REVIEW.value,
        nullable=False,
    )
    confidence: Mapped[float] = mapped_column(
        Float,
        nullable=False,
        default=0.0,
    )
    matching_signals: Mapped[dict] = mapped_column(
        JSONB,
        nullable=False,
        default=dict,
        server_default="{}",
    )
    policy_description: Mapped[Optional[str]] = mapped_column(
        Text,
        nullable=True,
    )
    explanation: Mapped[Optional[str]] = mapped_column(
        Text,
        nullable=True,
    )
    resolved_by: Mapped[Optional[uuid.UUID]] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("users.id", ondelete="SET NULL"),
        nullable=True,
    )
    resolved_at: Mapped[Optional[datetime]] = mapped_column(
        DateTime(timezone=True),
        nullable=True,
    )
    resolution_remarks: Mapped[Optional[str]] = mapped_column(
        Text,
        nullable=True,
    )
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        server_default=func.now(),
        nullable=False,
    )

    # Relationships
    application = relationship("Application", foreign_keys=[application_id], backref="conflicts")
    conflicting_application = relationship("Application", foreign_keys=[conflicting_application_id])
    resolver = relationship("User")
