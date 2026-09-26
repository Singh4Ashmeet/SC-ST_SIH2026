"""
Tests for authentication endpoints and role-based access control.
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


from tests.conftest import (
    TestBase,
    TestUser,
    TestScheme,
    TestApplication,
    TestDocument,
    TestAuditLog,
    engine,
    TestingSessionLocal,
)



def load_fixture(filename: str) -> dict:
    """Load JSON fixture from app/fixtures."""
    filepath = Path(__file__).resolve().parent.parent / "app" / "fixtures" / filename
    with open(filepath, "r", encoding="utf-8") as f:
        return json.load(f)


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


def _create_test_user(db, email: str, role: UserRole, password: str = "Test@123", full_name: str = None, is_active: bool = True) -> TestUser:
    """Helper to create a test user."""
    user = TestUser(
        email=email,
        hashed_password=hash_password(password),
        full_name=full_name or email.split("@")[0].title(),
        role=role,
        is_active=is_active,
    )
    db.add(user)
    db.commit()
    db.refresh(user)
    return user


def _create_test_scheme(db, code: str, config_data: dict) -> TestScheme:
    """Helper to create a test scheme."""
    scheme = TestScheme(
        code=code,
        name=f"{code} Scheme",
        description=f"Test {code} scheme",
        config=config_data,
        is_active=True,
    )
    db.add(scheme)
    db.commit()
    db.refresh(scheme)
    return scheme


def _get_token(user: TestUser) -> str:
    """Generate a JWT token for a user."""
    return create_access_token(user_id=user.id, role=user.role)


class TestAuthEndpoints:
    """Tests for authentication API endpoints."""

    @pytest.fixture
    def super_admin(self, db) -> TestUser:
        return _create_test_user(db, "super@test.com", UserRole.SUPER_ADMIN)

    @pytest.fixture
    def scheme_admin(self, db) -> TestUser:
        return _create_test_user(db, "scheme@test.com", UserRole.SCHEME_ADMIN)

    @pytest.fixture
    def client(self, db) -> TestClient:
        """Test client with test database session."""
        def override_get_db():
            try:
                yield db
            finally:
                pass
        
        app.dependency_overrides[get_db] = override_get_db
        client = TestClient(app)
        yield client
        app.dependency_overrides.clear()

    def test_login_success(self, client: TestClient, super_admin: TestUser):
        """Test successful login returns a valid token."""
        res = client.post("/api/auth/login", json={
            "email": "super@test.com",
            "password": "Test@123"
        })
        assert res.status_code == 200
        body = res.json()
        assert "access_token" in body
        assert body["token_type"] == "bearer"
        assert body["role"] == "SUPER_ADMIN"
        assert body["user_id"] == str(super_admin.id)

        # Verify token is valid by decoding
        from app.core.security import decode_access_token
        payload = decode_access_token(body["access_token"])
        assert payload["sub"] == str(super_admin.id)
        assert payload["role"] == "SUPER_ADMIN"

    def test_login_wrong_password(self, client: TestClient, super_admin: TestUser):
        """Test login with wrong password returns 401 with generic message."""
        res = client.post("/api/auth/login", json={
            "email": "super@test.com",
            "password": "WrongPassword"
        })
        assert res.status_code == 401
        body = res.json()
        assert body["detail"] == "Invalid credentials"

    def test_login_nonexistent_email(self, client: TestClient):
        """Test login with nonexistent email returns 401 with same generic message."""
        res = client.post("/api/auth/login", json={
            "email": "nonexistent@test.com",
            "password": "Test@123"
        })
        assert res.status_code == 401
        body = res.json()
        assert body["detail"] == "Invalid credentials"

    def test_login_inactive_user(self, client: TestClient, db):
        """Test login with inactive user returns 401."""
        _create_test_user(db, "inactive@test.com", UserRole.SCHEME_ADMIN, is_active=False)

        res = client.post("/api/auth/login", json={
            "email": "inactive@test.com",
            "password": "Test@123"
        })
        assert res.status_code == 401
        body = res.json()
        assert body["detail"] == "Account is inactive"

    def test_me_endpoint(self, client: TestClient, super_admin: TestUser):
        """Test /api/auth/me returns correct user info for valid token."""
        token = _get_token(super_admin)
        client.headers.update({"Authorization": f"Bearer {token}"})

        res = client.get("/api/auth/me")
        assert res.status_code == 200
        body = res.json()
        assert body["id"] == str(super_admin.id)
        assert body["email"] == "super@test.com"
        assert body["full_name"] == "Super"
        assert body["role"] == "SUPER_ADMIN"
        assert body["is_active"] is True

    def test_me_endpoint_no_token(self, client: TestClient):
        """Test /api/auth/me returns 401 without token."""
        res = client.get("/api/auth/me")
        assert res.status_code == 401

    def test_me_endpoint_invalid_token(self, client: TestClient):
        """Test /api/auth/me returns 401 with invalid token."""
        client.headers.update({"Authorization": "Bearer invalid.token.here"})
        res = client.get("/api/auth/me")
        assert res.status_code == 401


class TestRoleBasedAccess:
    """Tests for role-based access control on endpoints."""

    @pytest.fixture
    def nfst_scheme(self, db) -> TestScheme:
        return _create_test_scheme(db, "NFST", load_fixture("nfst_config.json"))

    def test_validate_config_super_admin_allowed(self, super_admin_client: TestClient, nfst_scheme):
        """SUPER_ADMIN can access validate-config."""
        nfst_data = load_fixture("nfst_config.json")
        res = super_admin_client.post("/api/schemes/validate-config", json=nfst_data)
        assert res.status_code == 200
        assert res.json()["valid"] is True

    def test_validate_config_scheme_admin_allowed(self, scheme_admin_client: TestClient, nfst_scheme):
        """SCHEME_ADMIN can access validate-config."""
        nfst_data = load_fixture("nfst_config.json")
        res = scheme_admin_client.post("/api/schemes/validate-config", json=nfst_data)
        assert res.status_code == 200
        assert res.json()["valid"] is True

    def test_validate_config_scrutiny_officer_forbidden(self, scrutiny_officer_client: TestClient, nfst_scheme):
        """SCRUTINY_OFFICER cannot access validate-config (403)."""
        nfst_data = load_fixture("nfst_config.json")
        res = scrutiny_officer_client.post("/api/schemes/validate-config", json=nfst_data)
        assert res.status_code == 403

    def test_validate_config_selection_committee_forbidden(self, selection_committee_client: TestClient, nfst_scheme):
        """SELECTION_COMMITTEE cannot access validate-config (403)."""
        nfst_data = load_fixture("nfst_config.json")
        res = selection_committee_client.post("/api/schemes/validate-config", json=nfst_data)
        assert res.status_code == 403

    def test_validate_config_unauthenticated(self, unauthenticated_client: TestClient):
        """Unauthenticated requests to validate-config return 401."""
        nfst_data = load_fixture("nfst_config.json")
        res = unauthenticated_client.post("/api/schemes/validate-config", json=nfst_data)
        assert res.status_code == 401

    def test_register_super_admin_can_create_scheme_admin(self, super_admin_client: TestClient):
        """SUPER_ADMIN can register SCHEME_ADMIN users."""
        res = super_admin_client.post("/api/auth/register", json={
            "email": "newscheme@test.com",
            "password": "NewPass@123",
            "full_name": "New Scheme Admin",
            "role": "SCHEME_ADMIN"
        })
        assert res.status_code == 201
        body = res.json()
        assert body["email"] == "newscheme@test.com"
        assert body["role"] == "SCHEME_ADMIN"

    def test_register_super_admin_can_create_scrutiny_officer(self, super_admin_client: TestClient):
        """SUPER_ADMIN can register SCRUTINY_OFFICER users."""
        res = super_admin_client.post("/api/auth/register", json={
            "email": "newscrutiny@test.com",
            "password": "NewPass@123",
            "full_name": "New Scrutiny Officer",
            "role": "SCRUTINY_OFFICER"
        })
        assert res.status_code == 201
        body = res.json()
        assert body["role"] == "SCRUTINY_OFFICER"

    def test_register_super_admin_can_create_selection_committee(self, super_admin_client: TestClient):
        """SUPER_ADMIN can register SELECTION_COMMITTEE users."""
        res = super_admin_client.post("/api/auth/register", json={
            "email": "newselection@test.com",
            "password": "NewPass@123",
            "full_name": "New Selection Committee",
            "role": "SELECTION_COMMITTEE"
        })
        assert res.status_code == 201
        body = res.json()
        assert body["role"] == "SELECTION_COMMITTEE"

    def test_register_super_admin_cannot_create_super_admin(self, super_admin_client: TestClient):
        """SUPER_ADMIN cannot create another SUPER_ADMIN via register."""
        res = super_admin_client.post("/api/auth/register", json={
            "email": "anothersuper@test.com",
            "password": "NewPass@123",
            "full_name": "Another Super Admin",
            "role": "SUPER_ADMIN"
        })
        assert res.status_code == 400
        assert "cannot be created" in res.json()["detail"]

    def test_register_scheme_admin_forbidden(self, scheme_admin_client: TestClient):
        """SCHEME_ADMIN cannot register users (403)."""
        res = scheme_admin_client.post("/api/auth/register", json={
            "email": "new@test.com",
            "password": "NewPass@123",
            "full_name": "New User",
            "role": "SCHEME_ADMIN"
        })
        assert res.status_code == 403
        assert "Only SUPER_ADMIN" in res.json()["detail"]

    def test_register_unauthenticated(self, unauthenticated_client: TestClient):
        """Unauthenticated register returns 401."""
        res = unauthenticated_client.post("/api/auth/register", json={
            "email": "new@test.com",
            "password": "NewPass@123",
            "full_name": "New User",
            "role": "SCHEME_ADMIN"
        })
        assert res.status_code == 401


class TestApplicationEndpointsAuth:
    """Tests for application endpoints with authentication."""

    @pytest.fixture
    def scheme(self, db) -> TestScheme:
        return _create_test_scheme(db, "NFST", load_fixture("nfst_config.json"))

    @pytest.fixture
    def application(self, db, scheme) -> TestApplication:
        from app.services.scheme_config_validator import validate_scheme_config
        config = validate_scheme_config(scheme.config)
        app = TestApplication(
            scheme_id=scheme.id,
            applicant_name="Test Applicant",
            applicant_email="test@example.com",
            applicant_data={"age": 25, "annual_income": 300000, "category": "ST"},
            current_state=config.initial_state,
        )
        db.add(app)
        db.commit()
        db.refresh(app)
        return app

    def test_get_application_public(self, super_admin_client: TestClient, unauthenticated_client: TestClient, application):
        """GET /applications/{id} is public for applicant self-service."""
        res = unauthenticated_client.get(f"/api/applications/{application.id}")
        assert res.status_code == 200
        assert res.json()["id"] == str(application.id)

        # Authenticated client can also access
        res = super_admin_client.get(f"/api/applications/{application.id}")
        assert res.status_code == 200
        assert res.json()["id"] == str(application.id)

    def test_create_application_public(self, unauthenticated_client: TestClient, scheme):
        """POST /applications is public for applicant self-service."""
        res = unauthenticated_client.post("/api/applications", json={
            "scheme_id": str(scheme.id),
            "applicant_name": "Public Applicant",
            "applicant_email": "public@test.com",
            "applicant_phone": "9876543210",
            "applicant_data": {"category": "ST", "annual_income": 300000},
        })
        assert res.status_code == 201
        assert "id" in res.json()

    def test_list_applications_requires_auth(self, unauthenticated_client: TestClient):
        """GET /applications (admin list) requires authentication."""
        res = unauthenticated_client.get("/api/applications")
        assert res.status_code == 401

    def test_available_transitions_requires_auth(self, unauthenticated_client: TestClient, application):
        """GET /applications/{id}/available-transitions requires authentication."""
        res = unauthenticated_client.get(f"/api/applications/{application.id}/available-transitions")
        assert res.status_code == 401

    def test_apply_transition_requires_auth(self, unauthenticated_client: TestClient, application):
        """POST /applications/{id}/transition requires authentication."""
        res = unauthenticated_client.post(f"/api/applications/{application.id}/transition", json={
            "trigger": "auto_evaluate",
            "details": {}
        })
        assert res.status_code == 401

    def test_run_eligibility_check_public(self, unauthenticated_client: TestClient, application):
        """POST /applications/{id}/run-eligibility-check is public for applicant self-service."""
        res = unauthenticated_client.post(f"/api/applications/{application.id}/run-eligibility-check")
        assert res.status_code == 200
        assert "eligibility_result" in res.json()

    def test_audit_log_requires_auth(self, unauthenticated_client: TestClient, application):
        """GET /applications/{id}/audit-log requires authentication."""
        res = unauthenticated_client.get(f"/api/applications/{application.id}/audit-log")
        assert res.status_code == 401

    def test_deficiency_summary_public(self, unauthenticated_client: TestClient, application):
        """GET /applications/{id}/deficiency-summary is public for applicant self-service."""
        res = unauthenticated_client.get(f"/api/applications/{application.id}/deficiency-summary")
        assert res.status_code == 200
        assert "documents" in res.json()

    def test_run_document_scrutiny_public(self, unauthenticated_client: TestClient, application):
        """POST /applications/{id}/run-document-scrutiny is public for applicant self-service."""
        # First advance state via eligibility check
        unauthenticated_client.post(f"/api/applications/{application.id}/run-eligibility-check")
        res = unauthenticated_client.post(f"/api/applications/{application.id}/run-document-scrutiny")
        assert res.status_code == 200
        assert "deficiency_breakdown" in res.json()