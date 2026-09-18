"""
SQLAlchemy ORM models package.
Imports all models so Alembic autogenerate and the application discover them.
"""

from app.models.base import Base, BaseModelMixin, TimestampMixin, UUIDMixin
from app.models.user import User, UserRole
from app.models.scheme import Scheme
from app.models.application import Application
from app.models.document import Document, DocumentStatus
from app.models.audit_log import AuditLog

__all__ = [
    "Base",
    "UUIDMixin",
    "TimestampMixin",
    "BaseModelMixin",
    "User",
    "UserRole",
    "Scheme",
    "Application",
    "Document",
    "DocumentStatus",
    "AuditLog",
]
