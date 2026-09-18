"""
Pydantic schemas for Scheme entity.
"""

import uuid
from datetime import datetime
from typing import Any, Dict, Optional
from pydantic import BaseModel, ConfigDict, Field


class SchemeBase(BaseModel):
    """Shared scheme properties."""
    code: str
    name: str
    description: Optional[str] = None
    config: Dict[str, Any] = Field(default_factory=dict)
    is_active: bool = True


class SchemeCreate(SchemeBase):
    """Properties required on scheme creation."""
    pass


class SchemeUpdate(BaseModel):
    """Properties for partial scheme update (PATCH)."""
    name: Optional[str] = None
    description: Optional[str] = None
    config: Optional[Dict[str, Any]] = None
    is_active: Optional[bool] = None


class SchemeRead(SchemeBase):
    """Properties returned on scheme read."""
    id: uuid.UUID
    created_by: Optional[uuid.UUID] = None
    created_at: datetime
    updated_at: datetime

    model_config = ConfigDict(from_attributes=True)
