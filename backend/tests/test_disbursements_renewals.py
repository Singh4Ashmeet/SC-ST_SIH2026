"""
Tests for Post-Selection Management: Disbursements and Renewals.
"""

from datetime import date, datetime
import json
from pathlib import Path
from typing import Any, Dict, List, Optional
import uuid

import pytest
from fastapi.testclient import TestClient
from sqlalchemy import (
    Date,
    DateTime,
    ForeignKey,
    Integer,
    JSON,
    Numeric,
    String,
    Text,
    create_engine,
    func,
)
from sqlalchemy.dialects.postgresql import UUID as PG_UUID
from sqlalchemy.orm import DeclarativeBase, Mapped, mapped_column, sessionmaker

from app.core.database import get_db
from app.core.security import create_access_token, hash_password
from app.main import app
from app.models.disbursement import DisbursementStatus
from app.models.renewal import RenewalStatus
from app.models.user import UserRole


from tests.conftest import (
    TestBase,
    TestUser,
    TestScheme,
    TestApplication,
    TestDocument,
    TestAuditLog,
    TestDisbursement,
    TestRenewal,
    engine,
    TestingSessionLocal,
)


def load_fixture(filename: str) -> Dict[str, Any]:
    filepath = Path(__file__).resolve().parent.parent / "app" / "fixtures" / filename
    with open(filepath, "r", encoding="utf-8") as f:
        return json.load(f)


@pytest.fixture(scope="function")
def db():
    TestBase.metadata.create_all(bind=engine)
    session = TestingSessionLocal()
    try:
        yield session
    finally:
        session.close()
        TestBase.metadata.drop_all(bind=engine)


def _create_test_user(db, email: str, role: UserRole, password: str = "Test@123") -> TestUser:
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
    return create_access_token(user_id=user.id, role=user.role)


def _create_test_scheme(db, code: str, config_data: dict) -> TestScheme:
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


def _create_test_application(db, scheme: TestScheme, state: str = "submitted") -> TestApplication:
    app_record = TestApplication(
        scheme_id=scheme.id,
        applicant_name="Ramesh Kumar",
        applicant_email="ramesh@example.com",
        applicant_data={"age": 25, "annual_income": 300000, "category": "SC"},
        current_state=state,
    )
    db.add(app_record)
    db.commit()
    db.refresh(app_record)
    return app_record


class TestDisbursementsAndRenewalsAPI:
    """Test suite for post-selection disbursements and renewals management."""

    @pytest.fixture
    def super_admin(self, db) -> TestUser:
        return _create_test_user(db, "superadmin@test.com", UserRole.SUPER_ADMIN)

    @pytest.fixture
    def selection_committee(self, db) -> TestUser:
        return _create_test_user(db, "selection@test.com", UserRole.SELECTION_COMMITTEE)

    @pytest.fixture
    def scrutiny_officer(self, db) -> TestUser:
        return _create_test_user(db, "scrutiny@test.com", UserRole.SCRUTINY_OFFICER)

    @pytest.fixture
    def scheme_admin(self, db) -> TestUser:
        return _create_test_user(db, "schemeadmin@test.com", UserRole.SCHEME_ADMIN)

    @pytest.fixture
    def committee_client(self, selection_committee, db) -> TestClient:
        client = TestClient(app)
        token = _get_token(selection_committee)
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
    def scrutiny_client(self, scrutiny_officer, db) -> TestClient:
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
    def unauth_client(self, db) -> TestClient:
        client = TestClient(app)

        def override_get_db():
            try:
                yield db
            finally:
                pass

        app.dependency_overrides[get_db] = override_get_db
        yield client
        app.dependency_overrides.clear()

    def test_disbursement_rejected_on_unapproved_application(self, committee_client, db):
        """Disbursement creation is rejected with 400 when application is not in an approved state."""
        nos_config = load_fixture("nos_config.json")
        scheme = _create_test_scheme(db, "NOS_UNAPPROVED", nos_config)
        # Application is in initial 'submitted' state
        app_record = _create_test_application(db, scheme, state="submitted")

        payload = {
            "amount": "50000.00",
            "installment_number": 1,
            "remarks": "First semester allowance",
        }
        resp = committee_client.post(f"/api/applications/{app_record.id}/disbursements", json=payload)
        assert resp.status_code == 400
        data = resp.json()
        assert "Disbursement cannot be created" in data["detail"]
        assert "submitted" in data["detail"]

    def test_disbursement_creation_succeeded_on_approved_application(
        self, committee_client, selection_committee, db
    ):
        """Disbursement creation succeeds (201) when application is in approved state and logs audit trail."""
        nos_config = load_fixture("nos_config.json")
        scheme = _create_test_scheme(db, "NOS_APPROVED", nos_config)
        # Application is in 'approved' state
        app_record = _create_test_application(db, scheme, state="approved")

        payload = {
            "amount": "75000.00",
            "installment_number": 1,
            "remarks": "Tuition fees tranche 1",
        }
        resp = committee_client.post(f"/api/applications/{app_record.id}/disbursements", json=payload)
        assert resp.status_code == 201
        data = resp.json()

        assert data["application_id"] == str(app_record.id)
        assert float(data["amount"]) == 75000.0
        assert data["status"] == "PENDING"
        assert data["installment_number"] == 1
        assert data["remarks"] == "Tuition fees tranche 1"
        assert data["disbursed_date"] is None
        assert data["created_by"] == str(selection_committee.id)

        # Verify audit log entry
        log = (
            db.query(TestAuditLog)
            .filter(
                TestAuditLog.application_id == app_record.id,
                TestAuditLog.action == "disbursement_created",
            )
            .first()
        )
        assert log is not None
        assert log.actor_user_id == selection_committee.id
        assert log.to_state == "PENDING"
        assert log.details["amount"] == 75000.0
        assert log.details["disbursement_id"] == data["id"]

    def test_disbursement_status_update_sets_disbursed_date(
        self, committee_client, selection_committee, db
    ):
        """Updating disbursement status to DISBURSED auto-sets disbursed_date to today."""
        nos_config = load_fixture("nos_config.json")
        scheme = _create_test_scheme(db, "NOS_UPDATE", nos_config)
        app_record = _create_test_application(db, scheme, state="approved")

        # Create initial disbursement
        create_resp = committee_client.post(
            f"/api/applications/{app_record.id}/disbursements",
            json={"amount": "30000.00", "installment_number": 1},
        )
        assert create_resp.status_code == 201
        disb_id = create_resp.json()["id"]

        # Patch status to DISBURSED without supplying disbursed_date
        patch_resp = committee_client.patch(
            f"/api/disbursements/{disb_id}",
            json={
                "status": "DISBURSED",
                "remarks": "Bank transfer completed successfully",
            },
        )
        assert patch_resp.status_code == 200
        patch_data = patch_resp.json()

        assert patch_data["status"] == "DISBURSED"
        assert patch_data["remarks"] == "Bank transfer completed successfully"
        assert patch_data["disbursed_date"] == str(date.today())

        # Verify audit log entry for update
        update_log = (
            db.query(TestAuditLog)
            .filter(
                TestAuditLog.application_id == app_record.id,
                TestAuditLog.action == "disbursement_updated",
            )
            .first()
        )
        assert update_log is not None
        assert update_log.from_state == "PENDING"
        assert update_log.to_state == "DISBURSED"
        assert update_log.actor_user_id == selection_committee.id
        assert update_log.details["old_status"] == "PENDING"
        assert update_log.details["new_status"] == "DISBURSED"

    def test_role_enforcement_on_disbursements(
        self, committee_client, scrutiny_client, unauth_client, db
    ):
        """SELECTION_COMMITTEE can create disbursements; SCRUTINY_OFFICER gets 403; unauthenticated gets 401."""
        nos_config = load_fixture("nos_config.json")
        scheme = _create_test_scheme(db, "NOS_ROLES", nos_config)
        app_record = _create_test_application(db, scheme, state="approved")

        payload = {"amount": "25000.00", "installment_number": 1}

        # Scrutiny officer -> 403 Forbidden
        scrutiny_resp = scrutiny_client.post(f"/api/applications/{app_record.id}/disbursements", json=payload)
        assert scrutiny_resp.status_code == 403

        # Unauthenticated -> 401 Unauthorized
        unauth_resp = unauth_client.post(f"/api/applications/{app_record.id}/disbursements", json=payload)
        assert unauth_resp.status_code == 401

        # Selection committee -> 201 Created
        committee_resp = committee_client.post(f"/api/applications/{app_record.id}/disbursements", json=payload)
        assert committee_resp.status_code == 201

        disb_id = committee_resp.json()["id"]

        # Scrutiny officer trying to PATCH -> 403
        scrutiny_patch = scrutiny_client.patch(f"/api/disbursements/{disb_id}", json={"status": "ON_HOLD"})
        assert scrutiny_patch.status_code == 403

    def test_renewal_cycle_creation_and_approval_cycle(
        self, committee_client, selection_committee, db
    ):
        """Create renewal cycle (PENDING_REVIEW), then approve it with reviewer and remarks."""
        nos_config = load_fixture("nos_config.json")
        scheme = _create_test_scheme(db, "NOS_RENEWAL", nos_config)
        app_record = _create_test_application(db, scheme, state="approved")

        # 1. Create renewal
        create_payload = {
            "academic_year_or_cycle": "2026-27",
            "due_date": "2027-04-30",
            "remarks": "Year 2 fellowship continuation",
        }
        create_resp = committee_client.post(f"/api/applications/{app_record.id}/renewals", json=create_payload)
        assert create_resp.status_code == 201
        ren_data = create_resp.json()

        assert ren_data["academic_year_or_cycle"] == "2026-27"
        assert ren_data["status"] == "PENDING_REVIEW"
        assert ren_data["due_date"] == "2027-04-30"
        assert ren_data["reviewed_date"] is None
        assert ren_data["reviewer_id"] is None
        assert ren_data["remarks"] == "Year 2 fellowship continuation"

        # Verify creation audit log
        ren_create_log = (
            db.query(TestAuditLog)
            .filter(
                TestAuditLog.application_id == app_record.id,
                TestAuditLog.action == "renewal_created",
            )
            .first()
        )
        assert ren_create_log is not None
        assert ren_create_log.to_state == "PENDING_REVIEW"

        renewal_id = ren_data["id"]

        # 2. Approve renewal
        approval_payload = {
            "status": "APPROVED",
            "remarks": "Satisfactory progress report and GPA verified.",
        }
        patch_resp = committee_client.patch(f"/api/renewals/{renewal_id}", json=approval_payload)
        assert patch_resp.status_code == 200
        approved_data = patch_resp.json()

        assert approved_data["status"] == "APPROVED"
        assert approved_data["reviewer_id"] == str(selection_committee.id)
        assert approved_data["reviewed_date"] == str(date.today())
        assert approved_data["remarks"] == "Satisfactory progress report and GPA verified."

        # Verify update audit log
        ren_update_log = (
            db.query(TestAuditLog)
            .filter(
                TestAuditLog.application_id == app_record.id,
                TestAuditLog.action == "renewal_updated",
            )
            .first()
        )
        assert ren_update_log is not None
        assert ren_update_log.from_state == "PENDING_REVIEW"
        assert ren_update_log.to_state == "APPROVED"
        assert ren_update_log.actor_user_id == selection_committee.id

    def test_renewal_rejection_cycle(self, committee_client, selection_committee, db):
        """Create renewal and reject it with reviewer notes."""
        nos_config = load_fixture("nos_config.json")
        scheme = _create_test_scheme(db, "NOS_RENEWAL_REJECT", nos_config)
        app_record = _create_test_application(db, scheme, state="approved")

        create_resp = committee_client.post(
            f"/api/applications/{app_record.id}/renewals",
            json={"academic_year_or_cycle": "2027-28", "due_date": "2028-04-30"},
        )
        assert create_resp.status_code == 201
        renewal_id = create_resp.json()["id"]

        reject_resp = committee_client.patch(
            f"/api/renewals/{renewal_id}",
            json={"status": "REJECTED", "remarks": "Failed minimum credit requirements."},
        )
        assert reject_resp.status_code == 200
        rejected_data = reject_resp.json()
        assert rejected_data["status"] == "REJECTED"
        assert rejected_data["reviewer_id"] == str(selection_committee.id)
        assert rejected_data["reviewed_date"] == str(date.today())
        assert rejected_data["remarks"] == "Failed minimum credit requirements."

    def test_post_selection_summary_composite(self, committee_client, scrutiny_client, db):
        """Composite endpoint returns aggregate disbursement and renewal history."""
        nos_config = load_fixture("nos_config.json")
        scheme = _create_test_scheme(db, "NOS_COMPOSITE", nos_config)
        app_record = _create_test_application(db, scheme, state="approved")

        # 1. Create two disbursements
        d1 = committee_client.post(
            f"/api/applications/{app_record.id}/disbursements",
            json={"amount": "40000.00", "installment_number": 1, "remarks": "Installment 1"},
        ).json()
        committee_client.patch(f"/api/disbursements/{d1['id']}", json={"status": "DISBURSED"})

        committee_client.post(
            f"/api/applications/{app_record.id}/disbursements",
            json={"amount": "40000.00", "installment_number": 2, "remarks": "Installment 2"},
        )

        # 2. Create renewal
        r1 = committee_client.post(
            f"/api/applications/{app_record.id}/renewals",
            json={"academic_year_or_cycle": "2026-27", "due_date": "2027-05-31"},
        ).json()
        committee_client.patch(f"/api/renewals/{r1['id']}", json={"status": "APPROVED", "remarks": "Good standing"})

        # 3. Fetch summary with any authenticated user (e.g. Scrutiny Officer)
        summary_resp = scrutiny_client.get(f"/api/applications/{app_record.id}/post-selection-summary")
        assert summary_resp.status_code == 200
        summary = summary_resp.json()

        assert summary["application_id"] == str(app_record.id)
        assert len(summary["disbursements"]) == 2
        assert len(summary["renewals"]) == 1

        assert summary["disbursements"][0]["installment_number"] == 1
        assert summary["disbursements"][0]["status"] == "DISBURSED"
        assert summary["disbursements"][0]["disbursed_date"] == str(date.today())

        assert summary["disbursements"][1]["installment_number"] == 2
        assert summary["disbursements"][1]["status"] == "PENDING"

        assert summary["renewals"][0]["academic_year_or_cycle"] == "2026-27"
        assert summary["renewals"][0]["status"] == "APPROVED"
