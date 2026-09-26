"""
Merit evaluation model for scoring and ranking applicants.
"""

import uuid
from datetime import datetime
from typing import Any, Optional
from sqlalchemy import DateTime, Float, ForeignKey, Integer, String, func
from sqlalchemy.dialects.postgresql import JSONB, UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.models.base import Base, UUIDMixin


class MeritEvaluation(Base, UUIDMixin):
    """Merit score evaluation record for an application."""
    __tablename__ = "merit_evaluations"

    application_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("applications.id", ondelete="CASCADE"),
        index=True,
        nullable=False,
    )
    scheme_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("schemes.id", ondelete="CASCADE"),
        index=True,
        nullable=False,
    )
    total_score: Mapped[float] = mapped_column(
        Float,
        nullable=False,
        default=0.0,
    )
    rank: Mapped[Optional[int]] = mapped_column(
        Integer,
        nullable=True,
    )
    score_breakdown: Mapped[dict] = mapped_column(
        JSONB,
        nullable=False,
        default=dict,
        server_default="{}",
    )
    preference_factors: Mapped[Optional[dict]] = mapped_column(
        JSONB,
        nullable=True,
    )
    scheme_config_version: Mapped[int] = mapped_column(
        Integer,
        nullable=False,
        default=1,
    )
    evaluated_by: Mapped[Optional[uuid.UUID]] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("users.id", ondelete="SET NULL"),
        nullable=True,
    )
    evaluated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        server_default=func.now(),
        nullable=False,
    )

    # Relationships
    application = relationship("Application", backref="merit_evaluations")
    scheme = relationship("Scheme")
    evaluator = relationship("User")
