"""
AuditLog model for tracking all lifecycle transitions and administrative actions.
"""

import uuid
from datetime import datetime
from typing import TYPE_CHECKING, Any, Optional
from sqlalchemy import DateTime, ForeignKey, String, func
from sqlalchemy.dialects.postgresql import JSONB, UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.models.base import Base, UUIDMixin

if TYPE_CHECKING:
    from app.models.user import User
    from app.models.scheme import Scheme
    from app.models.application import Application


class AuditLog(Base, UUIDMixin):
    """Immutable audit trail entry."""
    __tablename__ = "audit_logs"

    application_id: Mapped[Optional[uuid.UUID]] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("applications.id", ondelete="CASCADE"),
        nullable=True,
        index=True,
    )
    scheme_id: Mapped[Optional[uuid.UUID]] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("schemes.id", ondelete="SET NULL"),
        nullable=True,
        index=True,
    )
    actor_user_id: Mapped[Optional[uuid.UUID]] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("users.id", ondelete="SET NULL"),
        nullable=True,
        index=True,
    )
    action: Mapped[str] = mapped_column(
        String(100),
        nullable=False,
    )
    from_state: Mapped[Optional[str]] = mapped_column(
        String(50),
        nullable=True,
    )
    to_state: Mapped[Optional[str]] = mapped_column(
        String(50),
        nullable=True,
    )
    details: Mapped[Optional[Any]] = mapped_column(
        JSONB,
        nullable=True,
    )
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        server_default=func.now(),
        index=True,
        nullable=False,
    )
    previous_hash: Mapped[Optional[str]] = mapped_column(
        String(64),
        nullable=True,
    )
    current_hash: Mapped[Optional[str]] = mapped_column(
        String(64),
        nullable=True,
    )

    # Relationships
    application: Mapped[Optional["Application"]] = relationship(
        "Application",
        back_populates="audit_logs",
    )
    scheme: Mapped[Optional["Scheme"]] = relationship(
        "Scheme",
    )
    actor: Mapped[Optional["User"]] = relationship(
        "User",
        back_populates="audit_logs",
    )
