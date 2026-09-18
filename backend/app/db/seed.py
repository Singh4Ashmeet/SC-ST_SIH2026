"""
Database seeding script for local development and testing.
Creates an initial SUPER_ADMIN user if one does not already exist.

Usage:
    python -m app.db.seed
    or
    python app/db/seed.py
"""

import sys
from pathlib import Path

# Ensure backend root is on sys.path when executed directly
backend_dir = Path(__file__).resolve().parent.parent.parent
if str(backend_dir) not in sys.path:
    sys.path.insert(0, str(backend_dir))

from sqlalchemy import select
from app.core.database import SessionLocal
from app.core.security import hash_password
from app.models.user import User, UserRole


def seed_super_admin() -> None:
    """Seed a default SUPER_ADMIN user if not present."""
    db = SessionLocal()
    try:
        query = select(User).where(User.email == "admin@scholarship.gov.in")
        existing_user = db.execute(query).scalar_one_or_none()

        if existing_user:
            print(f"Super admin already exists: {existing_user.email} (Role: {existing_user.role.value})")
            return

        # Default password for local development - should be changed in production
        default_password = "Admin@123"
        super_admin = User(
            email="admin@scholarship.gov.in",
            full_name="System Super Administrator",
            hashed_password=hash_password(default_password),
            role=UserRole.SUPER_ADMIN,
            is_active=True,
        )
        db.add(super_admin)
        db.commit()
        db.refresh(super_admin)
        print(f"Successfully seeded super admin: {super_admin.email} (ID: {super_admin.id})")
        print(f"Default password: {default_password}")
    except Exception as exc:
        db.rollback()
        print(f"Error seeding database: {exc}", file=sys.stderr)
        raise
    finally:
        db.close()


if __name__ == "__main__":
    seed_super_admin()
