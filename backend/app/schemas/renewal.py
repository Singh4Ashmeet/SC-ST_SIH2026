"""
Pydantic schemas for Renewal entity.
"""

import uuid
from datetime import date, datetime
from typing import Optional
from pydantic import BaseModel, ConfigDict, Field

from app.models.renewal import RenewalStatus


class RenewalCreate(BaseModel):
    """Properties required when creating a renewal record."""
    academic_year_or_cycle: str = Field(..., max_length=20, description="Academic year or cycle, e.g. '2026-27'")
    due_date: date = Field(..., description="Due date for the renewal cycle")
    remarks: Optional[str] = None


class RenewalUpdate(BaseModel):
    """Properties allowed when updating a renewal review status."""
    status: RenewalStatus
    remarks: Optional[str] = None


class RenewalRead(BaseModel):
    """Properties returned on renewal read."""
    id: uuid.UUID
    application_id: uuid.UUID
    academic_year_or_cycle: str
    status: RenewalStatus
    due_date: date
    reviewed_date: Optional[date] = None
    reviewer_id: Optional[uuid.UUID] = None
    remarks: Optional[str] = None
    created_at: datetime
    updated_at: datetime

    model_config = ConfigDict(from_attributes=True)
