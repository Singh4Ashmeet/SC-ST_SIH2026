"""
Shared test configuration and fixtures for authentication.
Uses test-specific models compatible with SQLite.
"""

import json
import uuid
from pathlib import Path
from datetime import datetime

import pytest
from sqlalchemy import create_engine, JSON, String, Text, DateTime, func, ForeignKey
from sqlalchemy.dialects.postgresql import UUID as PG_UUID
from sqlalchemy.orm import sessionmaker, DeclarativeBase, Mapped, mapped_column, relationship
from typing import TYPE_CHECKING, List, Optional, Any
from fastapi.testclient import TestClient

from app.main import app
from app.core.database import get_db
from app.core.security import create_access_token, hash_password
from app.models.user import UserRole


# Test-specific models using SQLite-compatible types (JSON instead of JSONB)
class TestBase(DeclarativeBase):
    pass


class TestUUIDMixin:
    id: Mapped[uuid.UUID] = mapped_column(
        PG_UUID(as_uuid=True),
        primary_key=True,
        default=uuid.uuid4,
    )


class TestTimestampMixin:
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        server_default=func.now(),
        nullable=False,
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        server_default=func.now(),
        onupdate=func.now(),
        nullable=False,
    )


class TestBaseModelMixin(TestUUIDMixin, TestTimestampMixin):
    pass


if TYPE_CHECKING:
    from app.models.user import User


class TestUser(TestBase, TestBaseModelMixin):
    __tablename__ = "users"
    email: Mapped[str] = mapped_column(String(255), unique=True, index=True, nullable=False)
    hashed_password: Mapped[str] = mapped_column(String(255), nullable=False)
    full_name: Mapped[str] = mapped_column(String(255), nullable=False)
    role: Mapped[str] = mapped_column(String(50), nullable=False)
    is_active: Mapped[bool] = mapped_column(default=True, server_default="true", nullable=False)

    @property
    def value(self) -> str:
        """Return role value for compatibility with code expecting UserRole enum."""
        return self.role

    @property
    def role_enum(self) -> UserRole:
        """Return role as UserRole enum for compatibility."""
        return UserRole(self.role)


class TestScheme(TestBase, TestBaseModelMixin):
    __tablename__ = "schemes"
    code: Mapped[str] = mapped_column(String(50), unique=True, index=True, nullable=False)
    name: Mapped[str] = mapped_column(String(255), nullable=False)
    description: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    config: Mapped[dict] = mapped_column(JSON, nullable=False, default=dict)
    is_active: Mapped[bool] = mapped_column(default=True, nullable=False)
    created_by: Mapped[Optional[uuid.UUID]] = mapped_column(PG_UUID(as_uuid=True), nullable=True)


class TestApplication(TestBase, TestBaseModelMixin):
    __tablename__ = "applications"
    scheme_id: Mapped[uuid.UUID] = mapped_column(
        PG_UUID(as_uuid=True), ForeignKey("schemes.id", ondelete="CASCADE"), index=True, nullable=False
    )
    applicant_name: Mapped[str] = mapped_column(String(255), nullable=False)
    applicant_email: Mapped[str] = mapped_column(String(255), index=True, nullable=False)
    applicant_phone: Mapped[Optional[str]] = mapped_column(String(50), nullable=True)
    applicant_data: Mapped[dict] = mapped_column(JSON, nullable=False, default=dict)
    current_state: Mapped[str] = mapped_column(String(50), index=True, nullable=False, default="submitted")


class TestAuditLog(TestBase, TestUUIDMixin):
    __tablename__ = "audit_logs"
    application_id: Mapped[Optional[uuid.UUID]] = mapped_column(
        PG_UUID(as_uuid=True), ForeignKey("applications.id", ondelete="CASCADE"), nullable=True, index=True
    )
    scheme_id: Mapped[Optional[uuid.UUID]] = mapped_column(
        PG_UUID(as_uuid=True), ForeignKey("schemes.id", ondelete="SET NULL"), nullable=True, index=True
    )
    actor_user_id: Mapped[Optional[uuid.UUID]] = mapped_column(PG_UUID(as_uuid=True), nullable=True, index=True)
    action: Mapped[str] = mapped_column(String(100), nullable=False)
    from_state: Mapped[Optional[str]] = mapped_column(String(50), nullable=True)
    to_state: Mapped[Optional[str]] = mapped_column(String(50), nullable=True)
    details: Mapped[Optional[Any]] = mapped_column(JSON, nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), index=True, nullable=False)


# Test database setup
TEST_DB_URL = "sqlite:///./test_shared.db"
engine = create_engine(TEST_DB_URL, connect_args={"check_same_thread": False})
TestingSessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)


@pytest.fixture(scope="session", autouse=True)
def create_tables():
    """Create all tables once per test session."""
    TestBase.metadata.create_all(bind=engine)
    yield
    TestBase.metadata.drop_all(bind=engine)


@pytest.fixture(scope="function")
def db():
    """Create a fresh database session for each test."""
    TestBase.metadata.create_all(bind=engine)
    db = TestingSessionLocal()
    try:
        yield db
    finally:
        db.close()
        TestBase.metadata.drop_all(bind=engine)


def load_fixture(filename: str) -> dict:
    """Load JSON fixture from app/fixtures."""
    filepath = Path(__file__).resolve().parent.parent / "app" / "fixtures" / filename
    with open(filepath, "r", encoding="utf-8") as f:
        return json.load(f)


def _create_test_user(db, email: str, role: UserRole, password: str = "Test@123", full_name: str = None) -> TestUser:
    """Helper to create a test user."""
    user = TestUser(
        email=email,
        hashed_password=hash_password(password),
        full_name=full_name or email.split("@")[0].title(),
        role=role.value,
        is_active=True,
    )
    db.add(user)
    db.commit()
    db.refresh(user)
    return user


def _get_token(user: TestUser) -> str:
    """Generate a JWT token for a user."""
    return create_access_token(user_id=user.id, role=user.role)


@pytest.fixture
def super_admin_client(db) -> TestClient:
    """TestClient authenticated as SUPER_ADMIN with test database."""
    user = _create_test_user(db, "super@test.com", UserRole.SUPER_ADMIN)
    client = TestClient(app)
    token = _get_token(user)
    client.headers.update({"Authorization": f"Bearer {token}"})
    
    def override_get_db():
        try:
            yield db
        finally:
            pass
    app.dependency_overrides[get_db] = override_get_db
    yield client
    app.dependency_overrides.clear()


@pytest.fixture
def scheme_admin_client(db) -> TestClient:
    """TestClient authenticated as SCHEME_ADMIN with test database."""
    user = _create_test_user(db, "scheme@test.com", UserRole.SCHEME_ADMIN)
    client = TestClient(app)
    token = _get_token(user)
    client.headers.update({"Authorization": f"Bearer {token}"})
    
    def override_get_db():
        try:
            yield db
        finally:
            pass
    app.dependency_overrides[get_db] = override_get_db
    yield client
    app.dependency_overrides.clear()


@pytest.fixture
def scrutiny_officer_client(db) -> TestClient:
    """TestClient authenticated as SCRUTINY_OFFICER with test database."""
    user = _create_test_user(db, "scrutiny@test.com", UserRole.SCRUTINY_OFFICER)
    client = TestClient(app)
    token = _get_token(user)
    client.headers.update({"Authorization": f"Bearer {token}"})
    
    def override_get_db():
        try:
            yield db
        finally:
            pass
    app.dependency_overrides[get_db] = override_get_db
    yield client
    app.dependency_overrides.clear()


@pytest.fixture
def selection_committee_client(db) -> TestClient:
    """TestClient authenticated as SELECTION_COMMITTEE with test database."""
    user = _create_test_user(db, "selection@test.com", UserRole.SELECTION_COMMITTEE)
    client = TestClient(app)
    token = _get_token(user)
    client.headers.update({"Authorization": f"Bearer {token}"})
    
    def override_get_db():
        try:
            yield db
        finally:
            pass
    app.dependency_overrides[get_db] = override_get_db
    yield client
    app.dependency_overrides.clear()


@pytest.fixture
def unauthenticated_client(db) -> TestClient:
    """TestClient without authentication but with test database."""
    client = TestClient(app)
    
    def override_get_db():
        try:
            yield db
        finally:
            pass
    app.dependency_overrides[get_db] = override_get_db
    yield client
    app.dependency_overrides.clear()