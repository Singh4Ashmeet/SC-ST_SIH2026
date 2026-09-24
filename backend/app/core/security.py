"""
Security utilities: password hashing and JWT token management.
"""

from datetime import datetime, timedelta, UTC
from typing import Dict, Optional
from uuid import UUID

from jose import JWTError, jwt
from passlib.context import CryptContext

from app.core.config import get_settings

settings = get_settings()

import bcrypt

def hash_password(plain: str) -> str:
    """Hash a plain text password using bcrypt."""
    pw_bytes = plain.encode('utf-8')[:72]
    salt = bcrypt.gensalt()
    return bcrypt.hashpw(pw_bytes, salt).decode('utf-8')


def verify_password(plain: str, hashed: str) -> bool:
    """Verify a plain text password against a bcrypt hash."""
    try:
        pw_bytes = plain.encode('utf-8')[:72]
        return bcrypt.checkpw(pw_bytes, hashed.encode('utf-8'))
    except Exception:
        return False


def create_access_token(
    user_id: UUID,
    role: str,
    expires_minutes: Optional[int] = None
) -> str:
    """
    Create a JWT access token.

    Args:
        user_id: The user's UUID
        role: The user's role (e.g., SUPER_ADMIN, SCHEME_ADMIN)
        expires_minutes: Token expiry in minutes (defaults to settings)

    Returns:
        Encoded JWT string
    """
    if expires_minutes is None:
        expires_minutes = settings.ACCESS_TOKEN_EXPIRE_MINUTES

    expire = datetime.now(UTC) + timedelta(minutes=expires_minutes)
    to_encode: Dict[str, any] = {
        "sub": str(user_id),
        "role": role,
        "exp": expire,
    }
    encoded_jwt = jwt.encode(
        to_encode,
        settings.SECRET_KEY,
        algorithm=settings.JWT_ALGORITHM
    )
    return encoded_jwt


def decode_access_token(token: str) -> Dict[str, any]:
    """
    Decode and validate a JWT access token.

    Args:
        token: The JWT token string

    Returns:
        Decoded payload dict with sub, role, exp

    Raises:
        JWTError: If token is invalid, expired, or malformed
    """
    try:
        payload = jwt.decode(
            token,
            settings.SECRET_KEY,
            algorithms=[settings.JWT_ALGORITHM]
        )
        return payload
    except JWTError as exc:
        raise JWTError(f"Invalid token: {exc}") from exc