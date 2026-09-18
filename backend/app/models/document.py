"""
Document model representing certificates and credentials uploaded for scrutiny.
"""

import enum
import uuid
from datetime import datetime
from typing import TYPE_CHECKING, Any, List, Optional
from sqlalchemy import DateTime, Enum as SQLEnum, ForeignKey, String, func
from sqlalchemy.dialects.postgresql import JSONB, UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.models.base import Base, UUIDMixin

if TYPE_CHECKING:
    from app.models.application import Application


class DocumentStatus(str, enum.Enum):
    """Scrutiny status of an uploaded document."""
    PENDING = "PENDING"
    VERIFIED = "VERIFIED"
    DEFICIENT = "DEFICIENT"


class Document(Base, UUIDMixin):
    """Document entity attached to an application."""
    __tablename__ = "documents"

    application_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("applications.id", ondelete="CASCADE"),
        index=True,
        nullable=False,
    )
    doc_type: Mapped[str] = mapped_column(
        String(100),
        nullable=False,
    )
    storage_key: Mapped[str] = mapped_column(
        String(500),
        nullable=False,
    )
    status: Mapped[DocumentStatus] = mapped_column(
        SQLEnum(DocumentStatus, name="document_status", native_enum=True),
        default=DocumentStatus.PENDING,
        server_default=DocumentStatus.PENDING.value,
        nullable=False,
    )
    content_type: Mapped[str] = mapped_column(
        String(100),
        nullable=True,
        default="application/octet-stream",
    )
    extracted_fields: Mapped[Optional[Any]] = mapped_column(
        JSONB,
        nullable=True,
    )
    deficiency_reasons: Mapped[Optional[Any]] = mapped_column(
        JSONB,
        nullable=True,
    )
    uploaded_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        server_default=func.now(),
        nullable=False,
    )
    reviewed_at: Mapped[Optional[datetime]] = mapped_column(
        DateTime(timezone=True),
        nullable=True,
    )

    # Relationships
    application: Mapped["Application"] = relationship(
        "Application",
        back_populates="documents",
    )
