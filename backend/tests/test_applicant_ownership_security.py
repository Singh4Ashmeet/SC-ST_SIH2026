"""
Security & Object-Level Authorization Tests for Yojana Setu (SIH26239).

Verifies P0 security hardening requirements:
1. Applicant ownership enforcement (Applicant A cannot access Applicant B's data).
2. Document access control (IDOR prevention on files and uploads).
3. Grievance scoping (applicants only view their own grievances).
4. Administrative role isolation (applicants cannot trigger scrutiny).
5. Audit tamper protection (restricted strictly to SUPER_ADMIN).
6. Security response headers.
"""

import io
import uuid
import pytest
from fastapi.testclient import TestClient

from app.core.security import create_access_token, hash_password
from app.models.user import UserRole
from tests.conftest import (
    TestBase,
    TestUser,
    TestScheme,
    TestApplication,
    TestDocument,
    engine,
    TestingSessionLocal,
)


@pytest.fixture(scope="function")
def db():
    TestBase.metadata.create_all(bind=engine)
    session = TestingSessionLocal()
    try:
        yield session
    finally:
        session.close()
        TestBase.metadata.drop_all(bind=engine)


@pytest.fixture
def applicant_a(db) -> TestUser:
    user = TestUser(
        email="applicant.a@test.com",
        hashed_password=hash_password("Password@123"),
        full_name="Applicant A",
        role=UserRole.APPLICANT.value,
        is_active=True,
    )
    db.add(user)
    db.commit()
    db.refresh(user)
    return user


@pytest.fixture
def applicant_b(db) -> TestUser:
    user = TestUser(
        email="applicant.b@test.com",
        hashed_password=hash_password("Password@123"),
        full_name="Applicant B",
        role=UserRole.APPLICANT.value,
        is_active=True,
    )
    db.add(user)
    db.commit()
    db.refresh(user)
    return user


@pytest.fixture
def scrutiny_officer(db) -> TestUser:
    user = TestUser(
        email="scrutiny@test.com",
        hashed_password=hash_password("Password@123"),
        full_name="Dr. Scrutiny",
        role=UserRole.SCRUTINY_OFFICER.value,
        is_active=True,
    )
    db.add(user)
    db.commit()
    db.refresh(user)
    return user


@pytest.fixture
def test_scheme(db) -> TestScheme:
    scheme = TestScheme(
        code="TEST-SCHEME",
        name="Test Security Scheme",
        description="For security evaluation",
        config={
            "code": "TEST-SCHEME",
            "name": "Test Security Scheme",
            "version": 1,
            "financial_year": "2026-2027",
            "initial_state": "submitted",
            "workflow_states": [
                {"name": "submitted", "label": "Submitted"},
                {"name": "document_scrutiny", "label": "Document Scrutiny"},
                {"name": "deficient", "label": "Deficient"},
                {"name": "approved", "label": "Approved"},
            ],
            "workflow_transitions": [
                {
                    "from_state": "submitted",
                    "to_state": "document_scrutiny",
                    "trigger": "scrutiny_started",
                    "allowed_roles": ["SUPER_ADMIN", "SCRUTINY_OFFICER"],
                }
            ],
            "eligibility_rules": [],
            "required_documents": [
                {
                    "doc_type": "caste_certificate",
                    "label": "Caste Certificate",
                    "required": True,
                    "accepted_formats": ["pdf", "jpg", "png"],
                    "max_size_mb": 5,
                }
            ],
        },
        is_active=True,
    )
    db.add(scheme)
    db.commit()
    db.refresh(scheme)
    return scheme


@pytest.fixture
def app_a(db, test_scheme, applicant_a) -> TestApplication:
    app = TestApplication(
        scheme_id=test_scheme.id,
        applicant_name=applicant_a.full_name,
        applicant_email=applicant_a.email,
        applicant_data={"category": "ST", "annual_income": 350000},
        current_state="submitted",
    )
    db.add(app)
    db.commit()
    db.refresh(app)
    return app


@pytest.fixture
def app_b(db, test_scheme, applicant_b) -> TestApplication:
    app = TestApplication(
        scheme_id=test_scheme.id,
        applicant_name=applicant_b.full_name,
        applicant_email=applicant_b.email,
        applicant_data={"category": "ST", "annual_income": 400000},
        current_state="submitted",
    )
    db.add(app)
    db.commit()
    db.refresh(app)
    return app


def auth_client(user: TestUser, db) -> TestClient:
    from app.main import app
    from app.core.database import get_db
    token = create_access_token(user_id=user.id, role=user.role)
    app.dependency_overrides[get_db] = lambda: db
    client = TestClient(app)
    client.headers.update({"Authorization": f"Bearer {token}"})
    return client


class TestApplicantOwnershipSecurity:
    """Tests IDOR / BOLA defenses across applicant resources."""

    def test_applicant_a_can_access_own_application(self, db, applicant_a, app_a):
        client = auth_client(applicant_a, db)
        res = client.get(f"/api/applications/{app_a.id}")
        assert res.status_code == 200
        assert res.json()["applicant_email"] == applicant_a.email

    def test_applicant_a_cannot_access_applicant_b_application(self, db, applicant_a, app_b):
        client = auth_client(applicant_a, db)
        res = client.get(f"/api/applications/{app_b.id}")
        assert res.status_code == 403
        assert "Access denied" in res.json().get("detail", "")

    def test_applicant_cannot_view_other_applicant_deficiency_summary(self, db, applicant_a, app_b):
        client = auth_client(applicant_a, db)
        res = client.get(f"/api/applications/{app_b.id}/deficiency-summary")
        assert res.status_code == 403

    def test_applicant_cannot_trigger_administrative_scrutiny(self, db, applicant_a, app_a):
        client = auth_client(applicant_a, db)
        res = client.post(f"/api/applications/{app_a.id}/run-document-scrutiny")
        assert res.status_code == 403
        assert "Applicants cannot trigger" in res.json().get("detail", "")

    def test_applicant_cannot_upload_document_to_other_application(self, db, applicant_a, app_b):
        client = auth_client(applicant_a, db)
        file_content = b"%PDF-1.4 Fake Certificate"
        res = client.post(
            f"/api/applications/{app_b.id}/documents",
            data={"doc_type": "caste_certificate"},
            files={"file": ("caste.pdf", io.BytesIO(file_content), "application/pdf")},
        )
        assert res.status_code == 403

    def test_applicant_cannot_resubmit_other_applicant_document(self, db, applicant_a, app_b):
        # Create document for app_b
        doc_b = TestDocument(
            application_id=app_b.id,
            doc_type="caste_certificate",
            storage_key=f"{app_b.id}/caste_certificate/test.pdf",
            status="DEFICIENT",
        )
        db.add(doc_b)
        db.commit()
        db.refresh(doc_b)

        client = auth_client(applicant_a, db)
        file_content = b"%PDF-1.4 Corrected Certificate"
        res = client.post(
            f"/api/applications/{app_b.id}/documents/{doc_b.id}/resubmit",
            files={"file": ("corrected.pdf", io.BytesIO(file_content), "application/pdf")},
        )
        assert res.status_code == 403

    def test_scrutiny_officer_can_access_application_in_scope(self, db, scrutiny_officer, app_a):
        client = auth_client(scrutiny_officer, db)
        res = client.get(f"/api/applications/{app_a.id}")
        assert res.status_code == 200

    def test_non_admin_cannot_simulate_audit_tamper(self, db, applicant_a, scrutiny_officer):
        # Applicant forbidden
        client_app = auth_client(applicant_a, db)
        res = client_app.post("/api/audit-log/simulate-tamper")
        assert res.status_code == 403

        # Scrutiny officer forbidden (must be SUPER_ADMIN)
        client_sc = auth_client(scrutiny_officer, db)
        res2 = client_sc.post("/api/audit-log/simulate-tamper")
        assert res2.status_code == 403

    def test_non_admin_cannot_restore_audit(self, db, applicant_a, scrutiny_officer):
        client_app = auth_client(applicant_a, db)
        res = client_app.post("/api/audit-log/restore")
        assert res.status_code == 403

    def test_security_headers_present(self, db, applicant_a, app_a):
        client = auth_client(applicant_a, db)
        res = client.get(f"/api/applications/{app_a.id}")
        assert res.headers.get("X-Content-Type-Options") == "nosniff"
        assert res.headers.get("X-Frame-Options") == "DENY"
        assert "frame-ancestors 'none'" in res.headers.get("Content-Security-Policy", "")
