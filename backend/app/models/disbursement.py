"""
Disbursement model for tracking scholarship/fellowship payment installments.
"""

import enum
import uuid
from datetime import date
from typing import TYPE_CHECKING, Optional
from sqlalchemy import (
    Date, Enum as SQLEnum, ForeignKey, Integer, Numeric, String, Text,
)
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.models.base import Base, BaseModelMixin

if TYPE_CHECKING:
    from app.models.application import Application
    from app.models.user import User


class DisbursementStatus(str, enum.Enum):
    """Payment status of a disbursement installment."""
    PENDING = "PENDING"
    DISBURSED = "DISBURSED"
    FAILED = "FAILED"
    ON_HOLD = "ON_HOLD"


class Disbursement(Base, BaseModelMixin):
    """Tracks individual disbursement installments for an approved application."""
    __tablename__ = "disbursements"

    application_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("applications.id", ondelete="CASCADE"),
        index=True,
        nullable=False,
    )
    amount: Mapped[float] = mapped_column(
        Numeric(12, 2),
        nullable=False,
    )
    disbursed_date: Mapped[Optional[date]] = mapped_column(
        Date,
        nullable=True,
    )
    status: Mapped[DisbursementStatus] = mapped_column(
        SQLEnum(DisbursementStatus, name="disbursement_status", native_enum=True),
        default=DisbursementStatus.PENDING,
        server_default=DisbursementStatus.PENDING.value,
        nullable=False,
    )
    installment_number: Mapped[int] = mapped_column(
        Integer,
        default=1,
        server_default="1",
        nullable=False,
    )
    remarks: Mapped[Optional[str]] = mapped_column(
        Text,
        nullable=True,
    )
    created_by: Mapped[Optional[uuid.UUID]] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("users.id", ondelete="SET NULL"),
        nullable=True,
    )

    # Relationships
    application: Mapped["Application"] = relationship(
        "Application",
        back_populates="disbursements",
    )
    creator: Mapped[Optional["User"]] = relationship(
        "User",
    )
