"""
Application model representing a candidate's scheme submission.
"""

import uuid
from typing import TYPE_CHECKING, List, Optional
from sqlalchemy import ForeignKey, String
from sqlalchemy.dialects.postgresql import JSONB, UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.models.base import Base, BaseModelMixin

if TYPE_CHECKING:
    from app.models.scheme import Scheme
    from app.models.document import Document
    from app.models.audit_log import AuditLog


class Application(Base, BaseModelMixin):
    """Application submitted by a candidate under a scheme."""
    __tablename__ = "applications"

    scheme_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("schemes.id", ondelete="CASCADE"),
        index=True,
        nullable=False,
    )
    applicant_name: Mapped[str] = mapped_column(
        String(255),
        nullable=False,
    )
    applicant_email: Mapped[str] = mapped_column(
        String(255),
        index=True,
        nullable=False,
    )
    applicant_phone: Mapped[Optional[str]] = mapped_column(
        String(50),
        nullable=True,
    )
    applicant_data: Mapped[dict] = mapped_column(
        JSONB,
        nullable=False,
        default=dict,
        server_default="{}",
    )
    current_state: Mapped[str] = mapped_column(
        String(50),
        index=True,
        nullable=False,
        default="submitted",
        server_default="submitted",
    )

    # Relationships
    scheme: Mapped["Scheme"] = relationship(
        "Scheme",
        back_populates="applications",
    )
    documents: Mapped[List["Document"]] = relationship(
        "Document",
        back_populates="application",
        cascade="all, delete-orphan",
    )
    audit_logs: Mapped[List["AuditLog"]] = relationship(
        "AuditLog",
        back_populates="application",
        cascade="all, delete-orphan",
    )
