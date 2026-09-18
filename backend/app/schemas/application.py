"""
Pydantic schemas for Application entity.
"""

import uuid
from datetime import datetime
from typing import Any, Dict, Optional
from pydantic import BaseModel, ConfigDict, Field


class ApplicationBase(BaseModel):
    """Shared application properties."""
    scheme_id: uuid.UUID
    applicant_name: str
    applicant_email: str
    applicant_phone: Optional[str] = None
    applicant_data: Dict[str, Any] = Field(default_factory=dict)
    current_state: str = "submitted"


class ApplicationCreate(ApplicationBase):
    """Properties required on application creation."""
    pass


class ApplicationRead(ApplicationBase):
    """Properties returned on application read."""
    id: uuid.UUID
    created_at: datetime
    updated_at: datetime

    model_config = ConfigDict(from_attributes=True)
