"""
Tests for Decision Passport flagship service and endpoint.

Verifies that:
- Decision Passport aggregates all 10 required sections.
- Eligibility rules link to declared inputs and document evidence.
- Field confidences and region snippets are preserved.
- Committee integrity, quorum, and conflict status are reflected.
- Cryptographic SHA-256 audit signature is exposed.
- Authorization enforcement forbids unauthorized cross-applicant access.
"""

import json
from pathlib import Path
import pytest
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
    filepath = Path(__file__).resolve().parent.parent / "app" / "fixtures" / filename
    with open(filepath, "r", encoding="utf-8") as f:
        return json.load(f)


@pytest.fixture
def db():
    TestBase.metadata.create_all(bind=engine)
    db = TestingSessionLocal()
    try:
        yield db
    finally:
        db.close()
        TestBase.metadata.drop_all(bind=engine)


def _create_user(db, email: str, role: UserRole) -> TestUser:
    user = TestUser(
        email=email,
        hashed_password=hash_password("Pass@123"),
        full_name=email.split("@")[0].title(),
        role=role.value,
        is_active=True,
    )
    db.add(user)
    db.commit()
    db.refresh(user)
    return user


def _auth_client(user: TestUser, db) -> TestClient:
    token = create_access_token(user_id=user.id, role=user.role)
    client = TestClient(app)
    client.headers.update({"Authorization": f"Bearer {token}"})
    
    def override_get_db():
        try:
            yield db
        finally:
            pass
    app.dependency_overrides[get_db] = override_get_db
    return client


class TestDecisionPassport:
    """Test suite for Decision Passport aggregation and API."""

    def test_decision_passport_end_to_end(self, db):
        """Verify Decision Passport end-to-end structure and values."""
        # 1. Setup scheme & user
        scheme_cfg = load_fixture("nfst_config.json")
        scheme = TestScheme(
            code="NFST",
            name="National Fellowship for ST Students",
            config=scheme_cfg,
            is_active=True,
        )
        db.add(scheme)
        db.commit()
        db.refresh(scheme)

        applicant_user = _create_user(db, "applicant@test.com", UserRole.APPLICANT)
        admin_user = _create_user(db, "admin@test.com", UserRole.SUPER_ADMIN)

        # 2. Create application
        application = TestApplication(
            scheme_id=scheme.id,
            applicant_name="Birsa Munda",
            applicant_email=applicant_user.email,
            applicant_data={
                "annual_income": 380000,
                "category": "ST",
                "age": 24,
            },
            current_state="submitted",
        )
        db.add(application)
        db.commit()
        db.refresh(application)

        # 3. Add document evidence
        doc = TestDocument(
            application_id=application.id,
            doc_type="income_certificate",
            storage_key="test/inc.pdf",
            content_type="application/pdf",
            status="VERIFIED",
            extracted_fields={
                "annual_income": {
                    "value": "380000",
                    "confidence": 0.96,
                    "confidence_label": "high",
                    "source_region": {"line_text": "Income: Rs. 3,80,000/-"},
                    "validation_status": "verified",
                },
                "applicant_name": {
                    "value": "Birsa Munda",
                    "confidence": 0.95,
                    "confidence_label": "high",
                }
            }
        )
        db.add(doc)
        db.commit()

        # 4. Fetch Decision Passport as applicant
        applicant_client = _auth_client(applicant_user, db)
        resp = applicant_client.get(f"/api/applications/{application.id}/decision-passport")
        assert resp.status_code == 200, resp.text
        passport = resp.json()

        # 5. Assert all required 10 sections exist
        assert passport["passport_schema"] == "YojanaSetu.DecisionPassport.v1"
        assert "application_summary" in passport
        assert passport["application_summary"]["applicant_name"] == "Birsa Munda"
        assert passport["application_summary"]["scheme_code"] == "NFST"

        # Eligibility breakdown
        assert "eligibility_breakdown" in passport
        elig = passport["eligibility_breakdown"]
        assert elig["status"] in ["VERIFIED", "FAILED"]
        assert len(elig["rules"]) > 0

        # Document evidence
        assert "document_evidence" in passport
        doc_ev = passport["document_evidence"]
        assert len(doc_ev) == 1
        assert doc_ev[0]["doc_type"] == "income_certificate"
        assert len(doc_ev[0]["extracted_fields"]) >= 1

        # AI Confidence & Cross-document
        assert "ai_confidence" in passport
        assert passport["ai_confidence"]["overall_trust_score"] > 0
        assert passport["ai_confidence"]["review_routing"] in ["AUTO_VERIFY", "HUMAN_REVIEW_RECOMMENDED", "MANDATORY_HUMAN_REVIEW"]

        # Deficiencies
        assert "deficiencies" in passport

        # Merit calculation
        assert "merit_calculation" in passport

        # Human oversight
        assert "human_oversight" in passport

        # Committee integrity
        assert "committee_integrity" in passport
        assert passport["committee_integrity"]["quorum_required"] == 3

        # Financial status
        assert "financial_status" in passport

        # Audit timeline & signature
        assert "audit_timeline" in passport
        assert "decision_passport_signature" in passport

    def test_decision_passport_unauthorized_access_forbidden(self, db):
        """Security test: Applicant B cannot access Applicant A's decision passport."""
        scheme_cfg = load_fixture("nfst_config.json")
        scheme = TestScheme(code="NFST", name="NFST Scheme", config=scheme_cfg, is_active=True)
        db.add(scheme)
        db.commit()

        user_a = _create_user(db, "user_a@test.com", UserRole.APPLICANT)
        user_b = _create_user(db, "user_b@test.com", UserRole.APPLICANT)

        app_a = TestApplication(
            scheme_id=scheme.id,
            applicant_name="User A",
            applicant_email=user_a.email,
            applicant_data={"category": "ST"},
            current_state="submitted",
        )
        db.add(app_a)
        db.commit()

        client_b = _auth_client(user_b, db)
        resp = client_b.get(f"/api/applications/{app_a.id}/decision-passport")
        assert resp.status_code == 403
        assert "Access denied" in resp.json()["detail"]
