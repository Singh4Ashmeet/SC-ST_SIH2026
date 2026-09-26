"""
User model with role-based access control.
"""

import enum
from typing import TYPE_CHECKING, List, Optional
from sqlalchemy import Boolean, Enum as SQLEnum, String
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.models.base import Base, BaseModelMixin

if TYPE_CHECKING:
    from app.models.scheme import Scheme
    from app.models.audit_log import AuditLog


class UserRole(str, enum.Enum):
    """System user roles."""
    SUPER_ADMIN = "SUPER_ADMIN"
    SCHEME_ADMIN = "SCHEME_ADMIN"
    SCRUTINY_OFFICER = "SCRUTINY_OFFICER"
    SELECTION_COMMITTEE = "SELECTION_COMMITTEE"
    INSTITUTE_VERIFIER = "INSTITUTE_VERIFIER"
    NODAL_OFFICER = "NODAL_OFFICER"
    APPLICANT = "APPLICANT"


class User(Base, BaseModelMixin):
    """User entity for authentication and RBAC."""
    __tablename__ = "users"

    email: Mapped[str] = mapped_column(
        String(255),
        unique=True,
        index=True,
        nullable=False,
    )
    hashed_password: Mapped[str] = mapped_column(
        String(255),
        nullable=False,
    )
    full_name: Mapped[str] = mapped_column(
        String(255),
        nullable=False,
    )
    role: Mapped[UserRole] = mapped_column(
        SQLEnum(UserRole, name="user_role", native_enum=True),
        nullable=False,
    )
    is_active: Mapped[bool] = mapped_column(
        Boolean,
        default=True,
        server_default="true",
        nullable=False,
    )

    # Operational Scopes
    institution_id: Mapped[Optional[str]] = mapped_column(
        String(255),
        nullable=True,
        index=True,
    )
    state_scope: Mapped[Optional[str]] = mapped_column(
        String(100),
        nullable=True,
    )
    district_scope: Mapped[Optional[str]] = mapped_column(
        String(100),
        nullable=True,
    )
    assigned_scheme_ids: Mapped[Optional[dict]] = mapped_column(
        JSONB,
        nullable=True,
    )
    department_scope: Mapped[Optional[str]] = mapped_column(
        String(255),
        nullable=True,
    )
    active_assignment: Mapped[Optional[str]] = mapped_column(
        String(255),
        nullable=True,
    )

    # Relationships
    schemes: Mapped[List["Scheme"]] = relationship(
        "Scheme",
        back_populates="creator",
    )
    audit_logs: Mapped[List["AuditLog"]] = relationship(
        "AuditLog",
        back_populates="actor",
    )
