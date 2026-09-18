"""
Pydantic schemas for AuditLog entity.
"""

import uuid
from datetime import datetime
from typing import Any, Optional
from pydantic import BaseModel, ConfigDict


class AuditLogBase(BaseModel):
    """Shared audit log properties."""
    application_id: Optional[uuid.UUID] = None
    scheme_id: Optional[uuid.UUID] = None
    actor_user_id: Optional[uuid.UUID] = None
    action: str
    from_state: Optional[str] = None
    to_state: Optional[str] = None
    details: Optional[Any] = None


class AuditLogCreate(AuditLogBase):
    """Properties required on audit log entry creation."""
    pass


class AuditLogRead(AuditLogBase):
    """Properties returned on audit log read."""
    id: uuid.UUID
    created_at: datetime

    model_config = ConfigDict(from_attributes=True)
