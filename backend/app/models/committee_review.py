"""
Committee Review model for multi-member selection committee integrity,
quorum tracking, individual scoring, and conflict-of-interest declarations.
"""

import enum
import uuid
from datetime import datetime
from typing import Optional
from sqlalchemy import Boolean, DateTime, Float, ForeignKey, String, Text, func
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.models.base import Base, UUIDMixin


class CommitteeVote(str, enum.Enum):
    APPROVE = "APPROVE"
    REJECT = "REJECT"
    ABSTAIN = "ABSTAIN"
    HOLD = "HOLD"


class CommitteeReview(Base, UUIDMixin):
    """Individual selection committee member vote, review score, and conflict declaration."""
    __tablename__ = "committee_reviews"

    application_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("applications.id", ondelete="CASCADE"),
        index=True,
        nullable=False,
    )
    committee_member_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("users.id", ondelete="CASCADE"),
        index=True,
        nullable=False,
    )
    vote: Mapped[str] = mapped_column(
        String(50),
        nullable=False,
        default="APPROVE",
    )
    score: Mapped[Optional[float]] = mapped_column(
        Float,
        nullable=True,
    )
    comments: Mapped[Optional[str]] = mapped_column(
        Text,
        nullable=True,
    )
    conflict_declared: Mapped[bool] = mapped_column(
        Boolean,
        default=False,
        nullable=False,
    )
    conflict_reason: Mapped[Optional[str]] = mapped_column(
        Text,
        nullable=True,
    )
    reviewed_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        server_default=func.now(),
        nullable=False,
    )

    # Relationships
    application = relationship("Application", backref="committee_reviews")
    member = relationship("User")
