"""
Application model representing a candidate's scheme submission.
"""

import uuid
from typing import TYPE_CHECKING, List, Optional
from datetime import datetime
from sqlalchemy import DateTime, ForeignKey, String, func
from sqlalchemy.dialects.postgresql import JSONB, UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.models.base import Base, BaseModelMixin

if TYPE_CHECKING:
    from app.models.scheme import Scheme
    from app.models.document import Document
    from app.models.audit_log import AuditLog
    from app.models.disbursement import Disbursement
    from app.models.renewal import Renewal
    from app.models.user import User


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

    # Scoping & Assignment
    assigned_scrutiny_officer_id: Mapped[Optional[uuid.UUID]] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("users.id", ondelete="SET NULL"),
        nullable=True,
        index=True,
    )
    institution_id: Mapped[Optional[str]] = mapped_column(
        String(255),
        nullable=True,
        index=True,
    )
    state: Mapped[Optional[str]] = mapped_column(
        String(100),
        nullable=True,
        index=True,
    )
    district: Mapped[Optional[str]] = mapped_column(
        String(100),
        nullable=True,
        index=True,
    )
    current_responsible_role: Mapped[Optional[str]] = mapped_column(
        String(50),
        nullable=True,
        default="SCRUTINY_OFFICER",
        server_default="SCRUTINY_OFFICER",
    )
    current_responsible_user_id: Mapped[Optional[uuid.UUID]] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("users.id", ondelete="SET NULL"),
        nullable=True,
    )
    stage_entry_time: Mapped[Optional[datetime]] = mapped_column(
        DateTime(timezone=True),
        server_default=func.now(),
        nullable=True,
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
    disbursements: Mapped[List["Disbursement"]] = relationship(
        "Disbursement",
        back_populates="application",
        cascade="all, delete-orphan",
    )
    renewals: Mapped[List["Renewal"]] = relationship(
        "Renewal",
        back_populates="application",
        cascade="all, delete-orphan",
    )

