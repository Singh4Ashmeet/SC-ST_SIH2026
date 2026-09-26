"""
Institute verification model for institutional validation of applications.
"""

import enum
import uuid
from datetime import datetime
from typing import Optional
from sqlalchemy import DateTime, Enum as SQLEnum, ForeignKey, String, Text, func
from sqlalchemy.dialects.postgresql import JSONB, UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.models.base import Base, UUIDMixin


class InstituteVerificationStatus(str, enum.Enum):
    """Status of institute verification."""
    PENDING = "PENDING"
    VERIFIED = "VERIFIED"
    QUERY_RAISED = "QUERY_RAISED"
    RETURNED = "RETURNED"
    REJECTED = "REJECTED"


class InstituteVerification(Base, UUIDMixin):
    """Institute/nodal officer verification record for an application."""
    __tablename__ = "institute_verifications"

    application_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("applications.id", ondelete="CASCADE"),
        index=True,
        nullable=False,
    )
    institution_name: Mapped[str] = mapped_column(
        String(500),
        nullable=False,
    )
    institution_code: Mapped[Optional[str]] = mapped_column(
        String(100),
        nullable=True,
    )
    status: Mapped[InstituteVerificationStatus] = mapped_column(
        SQLEnum(InstituteVerificationStatus, name="institute_verification_status", native_enum=True),
        default=InstituteVerificationStatus.PENDING,
        server_default=InstituteVerificationStatus.PENDING.value,
        nullable=False,
    )
    verifier_user_id: Mapped[Optional[uuid.UUID]] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("users.id", ondelete="SET NULL"),
        nullable=True,
    )
    remarks: Mapped[Optional[str]] = mapped_column(
        Text,
        nullable=True,
    )
    query_details: Mapped[Optional[str]] = mapped_column(
        Text,
        nullable=True,
    )
    verification_data: Mapped[Optional[dict]] = mapped_column(
        JSONB,
        nullable=True,
    )
    verified_at: Mapped[Optional[datetime]] = mapped_column(
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
    application = relationship("Application", backref="institute_verifications")
    verifier = relationship("User")
