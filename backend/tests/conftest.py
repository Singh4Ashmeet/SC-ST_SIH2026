"""
Shared test configuration and fixtures for authentication.
Uses test-specific models compatible with SQLite.
"""

import json
import uuid
from pathlib import Path
from datetime import datetime, date

import pytest
from sqlalchemy import create_engine, JSON, String, Text, DateTime, Date, Numeric, Integer, func, ForeignKey
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
    __test__ = False


class TestUUIDMixin:
    __test__ = False
    id: Mapped[uuid.UUID] = mapped_column(
        PG_UUID(as_uuid=True),
        primary_key=True,
        default=uuid.uuid4,
    )


class TestTimestampMixin:
    __test__ = False
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
    __test__ = False


if TYPE_CHECKING:
    from app.models.user import User


class TestUser(TestBase, TestBaseModelMixin):
    __test__ = False
    __tablename__ = "users"
    email: Mapped[str] = mapped_column(String(255), unique=True, index=True, nullable=False)
    hashed_password: Mapped[str] = mapped_column(String(255), nullable=False)
    full_name: Mapped[str] = mapped_column(String(255), nullable=False)
    role: Mapped[str] = mapped_column(String(50), nullable=False)
    is_active: Mapped[bool] = mapped_column(default=True, server_default="true", nullable=False)
    institution_id: Mapped[Optional[str]] = mapped_column(String(255), nullable=True)
    state_scope: Mapped[Optional[str]] = mapped_column(String(100), nullable=True)
    district_scope: Mapped[Optional[str]] = mapped_column(String(100), nullable=True)
    assigned_scheme_ids: Mapped[Optional[dict]] = mapped_column(JSON, nullable=True)
    department_scope: Mapped[Optional[str]] = mapped_column(String(255), nullable=True)
    active_assignment: Mapped[Optional[str]] = mapped_column(String(255), nullable=True)

    @property
    def value(self) -> str:
        """Return role value for compatibility with code expecting UserRole enum."""
        return self.role

    @property
    def role_enum(self) -> UserRole:
        """Return role as UserRole enum for compatibility."""
        return UserRole(self.role)


class TestScheme(TestBase, TestBaseModelMixin):
    __test__ = False
    __tablename__ = "schemes"
    code: Mapped[str] = mapped_column(String(50), unique=True, index=True, nullable=False)
    name: Mapped[str] = mapped_column(String(255), nullable=False)
    description: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    config: Mapped[dict] = mapped_column(JSON, nullable=False, default=dict)
    is_active: Mapped[bool] = mapped_column(default=True, nullable=False)
    created_by: Mapped[Optional[uuid.UUID]] = mapped_column(PG_UUID(as_uuid=True), nullable=True)


class TestApplication(TestBase, TestBaseModelMixin):
    __test__ = False
    __tablename__ = "applications"
    scheme_id: Mapped[uuid.UUID] = mapped_column(
        PG_UUID(as_uuid=True), ForeignKey("schemes.id", ondelete="CASCADE"), index=True, nullable=False
    )
    applicant_name: Mapped[str] = mapped_column(String(255), nullable=False)
    applicant_email: Mapped[str] = mapped_column(String(255), index=True, nullable=False)
    applicant_phone: Mapped[Optional[str]] = mapped_column(String(50), nullable=True)
    applicant_data: Mapped[dict] = mapped_column(JSON, nullable=False, default=dict)
    current_state: Mapped[str] = mapped_column(String(50), index=True, nullable=False, default="submitted")
    assigned_scrutiny_officer_id: Mapped[Optional[uuid.UUID]] = mapped_column(PG_UUID(as_uuid=True), nullable=True)
    institution_id: Mapped[Optional[str]] = mapped_column(String(255), nullable=True)
    state: Mapped[Optional[str]] = mapped_column(String(100), nullable=True)
    district: Mapped[Optional[str]] = mapped_column(String(100), nullable=True)
    current_responsible_role: Mapped[Optional[str]] = mapped_column(String(50), nullable=True, default="SCRUTINY_OFFICER")
    current_responsible_user_id: Mapped[Optional[uuid.UUID]] = mapped_column(PG_UUID(as_uuid=True), nullable=True)
    stage_entry_time: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True), server_default=func.now(), nullable=True)


class TestDocument(TestBase, TestBaseModelMixin):
    __test__ = False
    __tablename__ = "documents"
    application_id: Mapped[uuid.UUID] = mapped_column(
        PG_UUID(as_uuid=True), ForeignKey("applications.id", ondelete="CASCADE"), index=True, nullable=False
    )
    doc_type: Mapped[str] = mapped_column(String(100), nullable=False)
    storage_key: Mapped[str] = mapped_column(String(500), nullable=False)
    content_type: Mapped[str] = mapped_column(String(100), nullable=True, default="application/octet-stream")
    status: Mapped[str] = mapped_column(String(20), default="PENDING", server_default="PENDING", nullable=False)
    extracted_fields: Mapped[Optional[Any]] = mapped_column(JSON, nullable=True)
    deficiency_reasons: Mapped[Optional[Any]] = mapped_column(JSON, nullable=True)
    uploaded_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), nullable=False)
    reviewed_at: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True), nullable=True)


class TestAuditLog(TestBase, TestUUIDMixin):
    __test__ = False
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
    previous_hash: Mapped[Optional[str]] = mapped_column(String(64), nullable=True)
    current_hash: Mapped[Optional[str]] = mapped_column(String(64), nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), index=True, nullable=False)


class TestDisbursement(TestBase, TestBaseModelMixin):
    __test__ = False
    __tablename__ = "disbursements"
    application_id: Mapped[uuid.UUID] = mapped_column(
        PG_UUID(as_uuid=True), ForeignKey("applications.id", ondelete="CASCADE"), index=True, nullable=False
    )
    amount: Mapped[float] = mapped_column(Numeric(12, 2), nullable=False)
    disbursed_date: Mapped[Optional[date]] = mapped_column(Date, nullable=True)
    status: Mapped[str] = mapped_column(String(20), default="PENDING", server_default="PENDING", nullable=False)
    installment_number: Mapped[int] = mapped_column(Integer, default=1, server_default="1", nullable=False)
    remarks: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    created_by: Mapped[Optional[uuid.UUID]] = mapped_column(PG_UUID(as_uuid=True), ForeignKey("users.id", ondelete="SET NULL"), nullable=True)


class TestRenewal(TestBase, TestBaseModelMixin):
    __test__ = False
    __tablename__ = "renewals"
    application_id: Mapped[uuid.UUID] = mapped_column(
        PG_UUID(as_uuid=True), ForeignKey("applications.id", ondelete="CASCADE"), index=True, nullable=False
    )
    academic_year_or_cycle: Mapped[str] = mapped_column(String(20), nullable=False)
    status: Mapped[str] = mapped_column(String(30), default="PENDING_REVIEW", server_default="PENDING_REVIEW", nullable=False)
    due_date: Mapped[date] = mapped_column(Date, nullable=False)
    reviewed_date: Mapped[Optional[date]] = mapped_column(Date, nullable=True)
    reviewer_id: Mapped[Optional[uuid.UUID]] = mapped_column(PG_UUID(as_uuid=True), ForeignKey("users.id", ondelete="SET NULL"), nullable=True)
    remarks: Mapped[Optional[str]] = mapped_column(Text, nullable=True)


# Relationships
TestApplication.scheme = relationship("TestScheme", back_populates="applications")
TestApplication.audit_logs = relationship("TestAuditLog", back_populates="application", cascade="all, delete-orphan")
TestApplication.documents = relationship("TestDocument", back_populates="application", cascade="all, delete-orphan")
TestScheme.applications = relationship("TestApplication", back_populates="scheme", cascade="all, delete-orphan")
TestDocument.application = relationship("TestApplication", back_populates="documents")
TestAuditLog.application = relationship("TestApplication", back_populates="audit_logs")




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