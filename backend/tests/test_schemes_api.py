"""
Tests for Schemes API: CRUD operations, validation, RBAC, audit logging.
"""

import json
import uuid
from datetime import datetime
from pathlib import Path
from typing import Any, Dict, List, Optional

import pytest
from fastapi.testclient import TestClient
from sqlalchemy import create_engine, JSON, String, Text, DateTime, func, ForeignKey, Boolean
from sqlalchemy.dialects.postgresql import UUID as PG_UUID
from sqlalchemy.orm import sessionmaker, DeclarativeBase, Mapped, mapped_column, relationship

from app.main import app
from app.core.database import get_db
from app.core.security import create_access_token, hash_password
from app.models.user import UserRole


# Test-specific models using SQLite-compatible types (JSON instead of JSONB)
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


def load_fixture(filename: str) -> Dict[str, Any]:
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


def _create_test_user(db, email: str, role: UserRole, password: str = "Test@123") -> TestUser:
    """Helper to create a test user."""
    user = TestUser(
        email=email,
        hashed_password=hash_password(password),
        full_name=email.split("@")[0].title(),
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


class TestSchemesAPI:
    """Tests for Schemes API endpoints."""

    @pytest.fixture
    def super_admin(self, db) -> TestUser:
        return _create_test_user(db, "super@test.com", UserRole.SUPER_ADMIN)

    @pytest.fixture
    def scheme_admin(self, db) -> TestUser:
        return _create_test_user(db, "scheme@test.com", UserRole.SCHEME_ADMIN)

    @pytest.fixture
    def scrutiny_officer(self, db) -> TestUser:
        return _create_test_user(db, "scrutiny@test.com", UserRole.SCRUTINY_OFFICER)

    @pytest.fixture
    def super_admin_client(self, super_admin, db) -> TestClient:
        client = TestClient(app)
        token = _get_token(super_admin)
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
    def scheme_admin_client(self, scheme_admin, db) -> TestClient:
        client = TestClient(app)
        token = _get_token(scheme_admin)
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
    def scrutiny_officer_client(self, scrutiny_officer, db) -> TestClient:
        client = TestClient(app)
        token = _get_token(scrutiny_officer)
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
    def unauthenticated_client(self, db) -> TestClient:
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

    @pytest.fixture
    def valid_nfst_config(self) -> Dict[str, Any]:
        return load_fixture("nfst_config.json")

    @pytest.fixture
    def valid_nos_config(self) -> Dict[str, Any]:
        return load_fixture("nos_config.json")

    # ===== CREATE TESTS =====

    def test_scheme_admin_can_create_valid_scheme(
        self, scheme_admin_client: TestClient, valid_nfst_config: Dict[str, Any]
    ):
        """SCHEME_ADMIN can create a scheme from a valid fixture config -> 201."""
        config = valid_nfst_config.copy()
        config["name"] = "National Fellowship for ST Students"
        config["description"] = "Test description"

        res = scheme_admin_client.post("/api/schemes", json={
            "code": "NFST",
            "name": config["name"],
            "description": config["description"],
            "config": config,
            "is_active": True,
        })

        assert res.status_code == 201
        body = res.json()
        assert body["code"] == "NFST"
        assert body["name"] == config["name"]
        assert body["is_active"] is True
        assert "id" in body
        assert "created_at" in body
        assert "created_by" in body

        # Verify scheme persisted in DB
        db = TestingSessionLocal()
        try:
            scheme = db.query(TestScheme).filter(TestScheme.code == "NFST").first()
            assert scheme is not None
            assert scheme.name == config["name"]
        finally:
            db.close()

    def test_super_admin_can_create_valid_scheme(
        self, super_admin_client: TestClient, valid_nos_config: Dict[str, Any]
    ):
        """SUPER_ADMIN can also create schemes."""
        config = valid_nos_config.copy()
        config["name"] = "National Overseas Scholarship"
        config["description"] = "Test description"

        res = super_admin_client.post("/api/schemes", json={
            "code": "NOS",
            "name": config["name"],
            "description": config["description"],
            "config": config,
            "is_active": True,
        })

        assert res.status_code == 201
        body = res.json()
        assert body["code"] == "NOS"

    def test_create_scheme_with_invalid_config_returns_422(
        self, scheme_admin_client: TestClient
    ):
        """Creating with an invalid config -> 422 with errors listed, nothing persisted."""
        invalid_config = {
            "scheme_code": "INVALID",
            "initial_state": "submitted",
            "workflow_states": [
                {"name": "submitted", "label": "Submitted", "is_terminal": False}
            ],
            "workflow_transitions": [
                {"from_state": "submitted", "to_state": "approved", "trigger": "approve", "allowed_roles": []}
            ],
            "required_documents": [],
            "eligibility_rules": [],
        }

        res = scheme_admin_client.post("/api/schemes", json={
            "code": "INVALID",
            "name": "Invalid Scheme",
            "config": invalid_config,
        })

        assert res.status_code == 422
        body = res.json()
        assert body["detail"]["valid"] is False
        assert "errors" in body["detail"]
        assert len(body["detail"]["errors"]) > 0

        # Verify nothing persisted
        db = TestingSessionLocal()
        try:
            scheme = db.query(TestScheme).filter(TestScheme.code == "INVALID").first()
            assert scheme is None
        finally:
            db.close()

    def test_duplicate_scheme_code_returns_409(
        self, scheme_admin_client: TestClient, valid_nfst_config: Dict[str, Any]
    ):
        """Duplicate scheme code -> 409."""
        config = valid_nfst_config.copy()
        config["name"] = "NFST Scheme"
        config["description"] = "First"

        # Create first scheme
        res1 = scheme_admin_client.post("/api/schemes", json={
            "code": "NFST",
            "name": config["name"],
            "description": config["description"],
            "config": config,
        })
        assert res1.status_code == 201

        # Try to create duplicate
        res2 = scheme_admin_client.post("/api/schemes", json={
            "code": "NFST",
            "name": "NFST Duplicate",
            "config": config,
        })

        assert res2.status_code == 409
        body = res2.json()
        assert "already exists" in body["detail"]

    def test_scrutiny_officer_cannot_create_scheme(
        self, scrutiny_officer_client: TestClient, valid_nfst_config: Dict[str, Any]
    ):
        """SCRUTINY_OFFICER attempting to create a scheme -> 403."""
        config = valid_nfst_config.copy()
        config["name"] = "NFST Scheme"

        res = scrutiny_officer_client.post("/api/schemes", json={
            "code": "NFST2",
            "name": config["name"],
            "config": config,
        })

        assert res.status_code == 403

    def test_unauthenticated_create_returns_401(
        self, unauthenticated_client: TestClient, valid_nfst_config: Dict[str, Any]
    ):
        """Unauthenticated create attempt -> 401."""
        config = valid_nfst_config.copy()
        config["name"] = "NFST Scheme"

        res = unauthenticated_client.post("/api/schemes", json={
            "code": "NFST3",
            "name": config["name"],
            "config": config,
        })

        assert res.status_code == 401

    # ===== READ TESTS =====

    def test_list_schemes_works_for_any_authenticated_role(
        self, scheme_admin_client: TestClient, valid_nfst_config: Dict[str, Any]
    ):
        """GET list works for any authenticated role."""
        # Create a scheme first
        config = valid_nfst_config.copy()
        config["name"] = "NFST Scheme"
        scheme_admin_client.post("/api/schemes", json={
            "code": "NFST",
            "name": config["name"],
            "config": config,
        })

        # List with SCHEME_ADMIN
        res = scheme_admin_client.get("/api/schemes")
        assert res.status_code == 200
        schemes = res.json()
        assert len(schemes) >= 1
        assert any(s["code"] == "NFST" for s in schemes)

    def test_list_schemes_with_is_active_filter(
        self, scheme_admin_client: TestClient, valid_nfst_config: Dict[str, Any]
    ):
        """GET list with ?is_active filter."""
        config = valid_nfst_config.copy()
        config["name"] = "NFST Scheme"
        scheme_admin_client.post("/api/schemes", json={
            "code": "NFST",
            "name": config["name"],
            "config": config,
            "is_active": True,
        })

        # Filter active
        res = scheme_admin_client.get("/api/schemes?is_active=true")
        assert res.status_code == 200
        assert all(s["is_active"] for s in res.json())

        # Filter inactive (should be empty)
        res = scheme_admin_client.get("/api/schemes?is_active=false")
        assert res.status_code == 200
        assert len(res.json()) == 0

    def test_get_scheme_by_id_works(
        self, scheme_admin_client: TestClient, valid_nfst_config: Dict[str, Any]
    ):
        """GET by ID works for any authenticated role."""
        config = valid_nfst_config.copy()
        config["name"] = "NFST Scheme"
        create_res = scheme_admin_client.post("/api/schemes", json={
            "code": "NFST",
            "name": config["name"],
            "config": config,
        })
        scheme_id = create_res.json()["id"]

        res = scheme_admin_client.get(f"/api/schemes/{scheme_id}")
        assert res.status_code == 200
        body = res.json()
        assert body["id"] == scheme_id
        assert body["code"] == "NFST"

    def test_get_scheme_by_code_works(
        self, scheme_admin_client: TestClient, valid_nfst_config: Dict[str, Any]
    ):
        """GET by code works for any authenticated role."""
        config = valid_nfst_config.copy()
        config["name"] = "NFST Scheme"
        scheme_admin_client.post("/api/schemes", json={
            "code": "NFST",
            "name": config["name"],
            "config": config,
        })

        res = scheme_admin_client.get("/api/schemes/by-code/NFST")
        assert res.status_code == 200
        body = res.json()
        assert body["code"] == "NFST"
        assert body["name"] == config["name"]

    def test_get_nonexistent_scheme_returns_404(
        self, scheme_admin_client: TestClient
    ):
        """GET nonexistent scheme returns 404."""
        fake_id = str(uuid.uuid4())
        res = scheme_admin_client.get(f"/api/schemes/{fake_id}")
        assert res.status_code == 404

    def test_get_nonexistent_scheme_by_code_returns_404(
        self, scheme_admin_client: TestClient
    ):
        """GET nonexistent scheme by code returns 404."""
        res = scheme_admin_client.get("/api/schemes/by-code/NONEXISTENT")
        assert res.status_code == 404

    # ===== UPDATE TESTS =====

    def test_patch_updates_name_and_description(
        self, scheme_admin_client: TestClient, valid_nfst_config: Dict[str, Any]
    ):
        """PATCH updates name and description."""
        config = valid_nfst_config.copy()
        config["name"] = "NFST Scheme"
        create_res = scheme_admin_client.post("/api/schemes", json={
            "code": "NFST",
            "name": config["name"],
            "config": config,
        })
        scheme_id = create_res.json()["id"]

        # Update name and description
        res = scheme_admin_client.patch(f"/api/schemes/{scheme_id}", json={
            "name": "Updated NFST Name",
            "description": "Updated description",
        })

        assert res.status_code == 200
        body = res.json()
        assert body["name"] == "Updated NFST Name"
        assert body["description"] == "Updated description"

    def test_patch_updates_config_and_bumps_version(
        self, scheme_admin_client: TestClient, valid_nfst_config: Dict[str, Any]
    ):
        """PATCH updates config and bumps version."""
        config = valid_nfst_config.copy()
        config["name"] = "NFST Scheme"
        create_res = scheme_admin_client.post("/api/schemes", json={
            "code": "NFST",
            "name": config["name"],
            "config": config,
        })
        scheme_id = create_res.json()["id"]
        original_version = create_res.json()["config"].get("version", 1)

        # Update config - change income threshold
        new_config = config.copy()
        new_config["eligibility_rules"][1]["condition"]["<="][1] = 700000

        res = scheme_admin_client.patch(f"/api/schemes/{scheme_id}", json={
            "config": new_config,
        })

        assert res.status_code == 200
        body = res.json()
        assert body["config"]["version"] == original_version + 1
        assert body["config"]["eligibility_rules"][1]["condition"]["<="][1] == 700000

    def test_patch_config_with_invalid_config_returns_422(
        self, scheme_admin_client: TestClient, valid_nfst_config: Dict[str, Any]
    ):
        """PATCH with invalid config returns 422 and doesn't update."""
        config = valid_nfst_config.copy()
        config["name"] = "NFST Scheme"
        create_res = scheme_admin_client.post("/api/schemes", json={
            "code": "NFST",
            "name": config["name"],
            "config": config,
        })
        scheme_id = create_res.json()["id"]
        original_config = create_res.json()["config"]

        # Try to update with invalid config
        invalid_config = {
            "scheme_code": "INVALID",
            "initial_state": "submitted",
            "workflow_states": [{"name": "submitted", "label": "Submitted", "is_terminal": False}],
            "workflow_transitions": [],
            "required_documents": [],
            "eligibility_rules": [],
        }

        res = scheme_admin_client.patch(f"/api/schemes/{scheme_id}", json={
            "config": invalid_config,
        })

        assert res.status_code == 422
        body = res.json()
        assert body["detail"]["valid"] is False

        # Verify original config unchanged
        res = scheme_admin_client.get(f"/api/schemes/{scheme_id}")
        assert res.json()["config"] == original_config

    def test_patch_no_changes_returns_400(
        self, scheme_admin_client: TestClient, valid_nfst_config: Dict[str, Any]
    ):
        """PATCH with no changes returns 400."""
        config = valid_nfst_config.copy()
        config["name"] = "NFST Scheme"
        create_res = scheme_admin_client.post("/api/schemes", json={
            "code": "NFST",
            "name": config["name"],
            "config": config,
        })
        scheme_id = create_res.json()["id"]

        res = scheme_admin_client.patch(f"/api/schemes/{scheme_id}", json={})
        assert res.status_code == 400

    # ===== ACTIVATE/DEACTIVATE TESTS =====

    def test_deactivate_scheme_toggles_is_active(
        self, scheme_admin_client: TestClient, valid_nfst_config: Dict[str, Any]
    ):
        """POST /deactivate toggles is_active to False."""
        config = valid_nfst_config.copy()
        config["name"] = "NFST Scheme"
        create_res = scheme_admin_client.post("/api/schemes", json={
            "code": "NFST",
            "name": config["name"],
            "config": config,
            "is_active": True,
        })
        scheme_id = create_res.json()["id"]
        assert create_res.json()["is_active"] is True

        # Deactivate
        res = scheme_admin_client.post(f"/api/schemes/{scheme_id}/deactivate")
        assert res.status_code == 200
        assert res.json()["is_active"] is False

        # Verify in list with filter
        res = scheme_admin_client.get("/api/schemes?is_active=true")
        assert len(res.json()) == 0

        res = scheme_admin_client.get("/api/schemes?is_active=false")
        assert len(res.json()) == 1

    def test_activate_scheme_toggles_is_active(
        self, scheme_admin_client: TestClient, valid_nfst_config: Dict[str, Any]
    ):
        """POST /activate toggles is_active to True."""
        config = valid_nfst_config.copy()
        config["name"] = "NFST Scheme"
        create_res = scheme_admin_client.post("/api/schemes", json={
            "code": "NFST",
            "name": config["name"],
            "config": config,
            "is_active": False,
        })
        scheme_id = create_res.json()["id"]
        assert create_res.json()["is_active"] is False

        # Activate
        res = scheme_admin_client.post(f"/api/schemes/{scheme_id}/activate")
        assert res.status_code == 200
        assert res.json()["is_active"] is True

    def test_deactivate_already_inactive_returns_400(
        self, scheme_admin_client: TestClient, valid_nfst_config: Dict[str, Any]
    ):
        """Deactivating already inactive scheme returns 400."""
        config = valid_nfst_config.copy()
        config["name"] = "NFST Scheme"
        create_res = scheme_admin_client.post("/api/schemes", json={
            "code": "NFST",
            "name": config["name"],
            "config": config,
            "is_active": False,
        })
        scheme_id = create_res.json()["id"]

        res = scheme_admin_client.post(f"/api/schemes/{scheme_id}/deactivate")
        assert res.status_code == 400
        assert "already inactive" in res.json()["detail"]

    def test_activate_already_active_returns_400(
        self, scheme_admin_client: TestClient, valid_nfst_config: Dict[str, Any]
    ):
        """Activating already active scheme returns 400."""
        config = valid_nfst_config.copy()
        config["name"] = "NFST Scheme"
        create_res = scheme_admin_client.post("/api/schemes", json={
            "code": "NFST",
            "name": config["name"],
            "config": config,
            "is_active": True,
        })
        scheme_id = create_res.json()["id"]

        res = scheme_admin_client.post(f"/api/schemes/{scheme_id}/activate")
        assert res.status_code == 400
        assert "already active" in res.json()["detail"]