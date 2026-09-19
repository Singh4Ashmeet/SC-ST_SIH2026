"""
Renewal model for tracking scholarship/fellowship renewal cycles.
"""

import enum
import uuid
from datetime import date
from typing import TYPE_CHECKING, Optional
from sqlalchemy import Date, Enum as SQLEnum, ForeignKey, String, Text
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.models.base import Base, BaseModelMixin

if TYPE_CHECKING:
    from app.models.application import Application
    from app.models.user import User


class RenewalStatus(str, enum.Enum):
    """Review status of a renewal request."""
    PENDING_REVIEW = "PENDING_REVIEW"
    APPROVED = "APPROVED"
    REJECTED = "REJECTED"


class Renewal(Base, BaseModelMixin):
    """Tracks renewal cycles for an approved application across academic years."""
    __tablename__ = "renewals"

    application_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("applications.id", ondelete="CASCADE"),
        index=True,
        nullable=False,
    )
    academic_year_or_cycle: Mapped[str] = mapped_column(
        String(20),
        nullable=False,
    )
    status: Mapped[RenewalStatus] = mapped_column(
        SQLEnum(RenewalStatus, name="renewal_status", native_enum=True),
        default=RenewalStatus.PENDING_REVIEW,
        server_default=RenewalStatus.PENDING_REVIEW.value,
        nullable=False,
    )
    due_date: Mapped[date] = mapped_column(
        Date,
        nullable=False,
    )
    reviewed_date: Mapped[Optional[date]] = mapped_column(
        Date,
        nullable=True,
    )
    reviewer_id: Mapped[Optional[uuid.UUID]] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("users.id", ondelete="SET NULL"),
        nullable=True,
    )
    remarks: Mapped[Optional[str]] = mapped_column(
        Text,
        nullable=True,
    )

    # Relationships
    application: Mapped["Application"] = relationship(
        "Application",
        back_populates="renewals",
    )
    reviewer: Mapped[Optional["User"]] = relationship(
        "User",
    )
