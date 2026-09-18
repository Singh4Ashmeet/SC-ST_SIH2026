"""
FastAPI dependencies for authentication and authorization.
"""

from typing import Annotated, Callable, Optional
from uuid import UUID

from fastapi import Depends, HTTPException, status
from fastapi.security import OAuth2PasswordBearer
from jose import JWTError
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.core.config import get_settings
from app.core.database import get_db
from app.core.security import decode_access_token
from app.models.user import User, UserRole

settings = get_settings()

# OAuth2 scheme for token extraction
oauth2_scheme = OAuth2PasswordBearer(tokenUrl="/api/auth/login")


async def get_current_user(
    token: Annotated[str, Depends(oauth2_scheme)],
    db: Annotated[Session, Depends(get_db)]
) -> User:
    """
    FastAPI dependency to get the current authenticated user.

    Extracts and validates JWT token, then loads user from database.
    Raises 401 if token is invalid, expired, or user not found/inactive.
    """
    try:
        payload = decode_access_token(token)
    except JWTError as exc:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid authentication credentials",
            headers={"WWW-Authenticate": "Bearer"},
        ) from exc
    except Exception as exc:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid authentication credentials",
            headers={"WWW-Authenticate": "Bearer"},
        ) from exc

    user_id_str = payload.get("sub")
    if not user_id_str:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid token: missing user id",
            headers={"WWW-Authenticate": "Bearer"},
        )

    try:
        user_id = UUID(user_id_str)
    except ValueError:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid token: malformed user id",
            headers={"WWW-Authenticate": "Bearer"},
        )

    user = db.execute(select(User).where(User.id == user_id)).scalar_one_or_none()
    if not user:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="User not found",
            headers={"WWW-Authenticate": "Bearer"},
        )

    if not user.is_active:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="User account is inactive",
            headers={"WWW-Authenticate": "Bearer"},
        )

    return user


def require_roles(*allowed_roles: str) -> Callable:
    """
    Dependency factory that creates a role-based authorization dependency.

    Args:
        *allowed_roles: Role names that are allowed to access the endpoint
                       (e.g., "SUPER_ADMIN", "SCHEME_ADMIN")

    Returns:
        A FastAPI dependency that returns the current user if their role
        is in allowed_roles, otherwise raises 403 Forbidden.
    """
    allowed_roles_set = set(allowed_roles)

    def role_checker(
        current_user: Annotated[User, Depends(get_current_user)]
    ) -> User:
        if current_user.role.value not in allowed_roles_set:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail=f"Access denied. Required role(s): {', '.join(allowed_roles)}"
            )
        return current_user

    return role_checker


# Convenience dependencies for common role combinations
require_super_admin = require_roles("SUPER_ADMIN")
require_scheme_admin = require_roles("SUPER_ADMIN", "SCHEME_ADMIN")
require_scrutiny_officer = require_roles("SUPER_ADMIN", "SCRUTINY_OFFICER")
require_selection_committee = require_roles("SUPER_ADMIN", "SELECTION_COMMITTEE")
require_any_role = require_roles(
    "SUPER_ADMIN", "SCHEME_ADMIN", "SCRUTINY_OFFICER", "SELECTION_COMMITTEE"
)

# Optional OAuth2 scheme for endpoints accessible to both authenticated users and public applicants
oauth2_scheme_optional = OAuth2PasswordBearer(tokenUrl="/api/auth/login", auto_error=False)


async def get_optional_current_user(
    token: Annotated[Optional[str], Depends(oauth2_scheme_optional)] = None,
    db: Session = Depends(get_db)
) -> Optional[User]:
    """Extract and validate JWT token if present, otherwise return None."""
    if not token:
        return None
    try:
        payload = decode_access_token(token)
        user_id_str = payload.get("sub")
        if not user_id_str:
            return None
        user_id = UUID(user_id_str)
        user = db.execute(select(User).where(User.id == user_id)).scalar_one_or_none()
        if user and user.is_active:
            return user
    except Exception:
        pass
    return None


from fastapi import Request


def require_applicant_or_roles(*allowed_roles: str) -> Callable:
    """
    Allow access if either:
    1. User is authenticated with one of the allowed roles, OR
    2. Request has X-Applicant-Portal header (applicant self-service without login per hackathon demo spec)
    """
    allowed_roles_set = set(allowed_roles)

    async def checker(
        request: Request,
        token: Annotated[Optional[str], Depends(oauth2_scheme_optional)] = None,
        db: Session = Depends(get_db),
    ) -> Optional[User]:
        if token:
            try:
                payload = decode_access_token(token)
                user_id_str = payload.get("sub")
                if not user_id_str:
                    raise HTTPException(
                        status_code=status.HTTP_401_UNAUTHORIZED,
                        detail="Invalid token: missing user id",
                        headers={"WWW-Authenticate": "Bearer"},
                    )
                user_id = UUID(user_id_str)
                user = db.execute(select(User).where(User.id == user_id)).scalar_one_or_none()
                if not user or not user.is_active:
                    raise HTTPException(
                        status_code=status.HTTP_401_UNAUTHORIZED,
                        detail="User not found or inactive",
                        headers={"WWW-Authenticate": "Bearer"},
                    )
                if user.role.value not in allowed_roles_set:
                    raise HTTPException(
                        status_code=status.HTTP_403_FORBIDDEN,
                        detail=f"Access denied. Required role(s): {', '.join(allowed_roles)}"
                    )
                return user
            except HTTPException:
                raise
            except Exception as exc:
                raise HTTPException(
                    status_code=status.HTTP_401_UNAUTHORIZED,
                    detail="Invalid authentication credentials",
                    headers={"WWW-Authenticate": "Bearer"},
                ) from exc

        # Unauthenticated: allow if applicant portal header is present
        if request.headers.get("X-Applicant-Portal") == "true":
            return None

        # Otherwise require authentication
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Not authenticated",
            headers={"WWW-Authenticate": "Bearer"},
        )

    return checker


require_applicant_or_any_role = require_applicant_or_roles(
    "SUPER_ADMIN", "SCHEME_ADMIN", "SCRUTINY_OFFICER", "SELECTION_COMMITTEE"
)
require_applicant_or_scrutiny = require_applicant_or_roles(
    "SUPER_ADMIN", "SCRUTINY_OFFICER"
)