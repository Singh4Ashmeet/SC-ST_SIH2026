"""
Pydantic schemas for Disbursement entity.
"""

import uuid
from datetime import date, datetime
from decimal import Decimal
from typing import Optional
from pydantic import BaseModel, ConfigDict, Field

from app.models.disbursement import DisbursementStatus


class DisbursementCreate(BaseModel):
    """Properties required when creating a disbursement."""
    amount: Decimal = Field(..., gt=0, description="Disbursement amount (positive)")
    installment_number: int = Field(default=1, ge=1, description="Installment sequence number")
    remarks: Optional[str] = None


class DisbursementUpdate(BaseModel):
    """Properties allowed when updating a disbursement."""
    status: DisbursementStatus
    remarks: Optional[str] = None
    disbursed_date: Optional[date] = None


class DisbursementRead(BaseModel):
    """Properties returned on disbursement read."""
    id: uuid.UUID
    application_id: uuid.UUID
    amount: Decimal
    disbursed_date: Optional[date] = None
    status: DisbursementStatus
    installment_number: int
    remarks: Optional[str] = None
    created_by: Optional[uuid.UUID] = None
    created_at: datetime
    updated_at: datetime

    model_config = ConfigDict(from_attributes=True)
