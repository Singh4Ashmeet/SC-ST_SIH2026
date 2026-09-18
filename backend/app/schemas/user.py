"""
Pydantic schemas for User entity.
"""

import uuid
from datetime import datetime
from pydantic import BaseModel, ConfigDict

from app.models.user import UserRole


class UserBase(BaseModel):
    """Shared user properties."""
    email: str
    full_name: str
    role: UserRole = UserRole.SCHEME_ADMIN
    is_active: bool = True


class UserCreate(UserBase):
    """Properties required on user creation."""
    password: str


class UserRead(UserBase):
    """Properties returned on user read."""
    id: uuid.UUID
    created_at: datetime
    updated_at: datetime

    model_config = ConfigDict(from_attributes=True)
