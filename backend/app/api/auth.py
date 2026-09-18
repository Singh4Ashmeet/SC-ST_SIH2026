"""
Authentication API router: login, register, and current user info.
"""

from typing import Annotated
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel, ConfigDict, EmailStr
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.core.config import get_settings
from app.core.database import get_db
from app.core.deps import get_current_user
from app.core.security import create_access_token, hash_password, verify_password
from app.models.user import User, UserRole

settings = get_settings()

router = APIRouter(prefix="/auth", tags=["Authentication"])


class LoginRequest(BaseModel):
    """Login request payload."""
    email: EmailStr
    password: str


class LoginResponse(BaseModel):
    """Login response with access token."""
    access_token: str
    token_type: str = "bearer"
    role: str
    user_id: str


class RegisterRequest(BaseModel):
    """User registration request (admin-only)."""
    email: EmailStr
    password: str
    full_name: str
    role: UserRole


class UserMeResponse(BaseModel):
    """Current user info response."""
    id: UUID
    email: str
    full_name: str
    role: UserRole
    is_active: bool

    model_config = ConfigDict(from_attributes=True)


class TokenPayload(BaseModel):
    """Decoded JWT token payload."""
    sub: str
    role: str
    exp: int


@router.post("/login", response_model=LoginResponse)
def login(
    credentials: LoginRequest,
    db: Session = Depends(get_db)
) -> LoginResponse:
    """
    Authenticate user and return access token.

    Returns 401 with generic message for both wrong email and wrong password
    to avoid user enumeration.
    """
    user = db.execute(
        select(User).where(User.email == credentials.email)
    ).scalar_one_or_none()

    if not user or not verify_password(credentials.password, user.hashed_password):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid credentials",
            headers={"WWW-Authenticate": "Bearer"},
        )

    if not user.is_active:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Account is inactive",
            headers={"WWW-Authenticate": "Bearer"},
        )

    access_token = create_access_token(
        user_id=user.id,
        role=user.role.value,
        expires_minutes=settings.ACCESS_TOKEN_EXPIRE_MINUTES
    )

    return LoginResponse(
        access_token=access_token,
        token_type="bearer",
        role=user.role.value,
        user_id=str(user.id)
    )


@router.post("/register", response_model=UserMeResponse, status_code=status.HTTP_201_CREATED)
def register(
    request: RegisterRequest,
    current_user: Annotated[User, Depends(get_current_user)],
    db: Session = Depends(get_db)
) -> UserMeResponse:
    """
    Register a new user (SUPER_ADMIN only).

    Only SUPER_ADMIN can create SCHEME_ADMIN, SCRUTINY_OFFICER, or
    SELECTION_COMMITTEE users. SUPER_ADMIN accounts are created via seed only.
    """
    # Check if current user is SUPER_ADMIN
    if current_user.role != UserRole.SUPER_ADMIN:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only SUPER_ADMIN can register new users"
        )

    # Validate role - only allow these roles to be created via register
    allowed_roles = {UserRole.SCHEME_ADMIN, UserRole.SCRUTINY_OFFICER, UserRole.SELECTION_COMMITTEE}
    if request.role not in allowed_roles:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Role {request.role.value} cannot be created via this endpoint. "
                   f"Allowed roles: {[r.value for r in allowed_roles]}"
        )

    # Check if email already exists
    existing = db.execute(
        select(User).where(User.email == request.email)
    ).scalar_one_or_none()
    if existing:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Email already registered"
        )

    # Create user with hashed password
    user = User(
        email=request.email,
        hashed_password=hash_password(request.password),
        full_name=request.full_name,
        role=request.role,
        is_active=True,
    )
    db.add(user)
    db.commit()
    db.refresh(user)

    return UserMeResponse.model_validate(user)


@router.get("/me", response_model=UserMeResponse)
def me(
    current_user: Annotated[User, Depends(get_current_user)]
) -> UserMeResponse:
    """Get current authenticated user's information."""
    return UserMeResponse.model_validate(current_user)