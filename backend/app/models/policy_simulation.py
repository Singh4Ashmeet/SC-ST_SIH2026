"""
Policy simulation model for tracking simulation runs.
"""

import uuid
from datetime import datetime
from typing import Any, Optional
from sqlalchemy import DateTime, ForeignKey, Integer, String, Text, func
from sqlalchemy.dialects.postgresql import JSONB, UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.models.base import Base, UUIDMixin


class PolicySimulation(Base, UUIDMixin):
    """Policy simulation run record."""
    __tablename__ = "policy_simulations"

    scheme_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("schemes.id", ondelete="CASCADE"),
        index=True,
        nullable=False,
    )
    simulation_name: Mapped[Optional[str]] = mapped_column(
        String(255),
        nullable=True,
    )
    base_config_version: Mapped[int] = mapped_column(
        Integer,
        nullable=False,
    )
    base_config: Mapped[dict] = mapped_column(
        JSONB,
        nullable=False,
    )
    proposed_config: Mapped[dict] = mapped_column(
        JSONB,
        nullable=False,
    )
    results: Mapped[dict] = mapped_column(
        JSONB,
        nullable=False,
        default=dict,
        server_default="{}",
    )
    summary: Mapped[Optional[str]] = mapped_column(
        Text,
        nullable=True,
    )
    run_by: Mapped[Optional[uuid.UUID]] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("users.id", ondelete="SET NULL"),
        nullable=True,
    )
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        server_default=func.now(),
        nullable=False,
    )

    # Relationships
    scheme = relationship("Scheme")
    administrator = relationship("User")
