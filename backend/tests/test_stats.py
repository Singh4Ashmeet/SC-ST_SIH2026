"""
Tests for Stats and Overview Analytics API.
"""

from datetime import date, datetime, timedelta, timezone
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
from app.models.document import DocumentStatus
from app.models.renewal import RenewalStatus
from app.models.user import UserRole


# SQLite test models
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


class TestUser(TestBase, TestBaseModelMixin):
    __test__ = False
    __tablename__ = "users"
    email: Mapped[str] = mapped_column(String(255), unique=True, index=True, nullable=False)
    hashed_password: Mapped[str] = mapped_column(String(255), nullable=False)
    full_name: Mapped[str] = mapped_column(String(255), nullable=False)
    role: Mapped[str] = mapped_column(String(50), nullable=False)
    is_active: Mapped[bool] = mapped_column(default=True, server_default="true", nullable=False)

    @property
    def value(self) -> str:
        return self.role


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


TEST_DB_URL = "sqlite:///./test_stats.db"
engine = create_engine(TEST_DB_URL, connect_args={"check_same_thread": False})
TestingSessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)


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


@pytest.fixture
def auth_client(db) -> TestClient:
    user = TestUser(
        email="admin@test.com",
        hashed_password=hash_password("Pass@123"),
        full_name="Admin User",
        role=UserRole.SUPER_ADMIN.value,
        is_active=True,
    )
    db.add(user)
    db.commit()
    db.refresh(user)

    client = TestClient(app)
    token = create_access_token(user_id=user.id, role=user.role)
    client.headers.update({"Authorization": f"Bearer {token}"})

    def override_get_db():
        try:
            yield db
        finally:
            pass

    app.dependency_overrides[get_db] = override_get_db
    yield client
    app.dependency_overrides.clear()


def test_overview_stats_aggregate_counts(auth_client, db):
    """Overview stats aggregate counts accurately across multiple schemes."""
    nos_config = load_fixture("nos_config.json")
    nfst_config = load_fixture("nfst_config.json")

    scheme_nos = TestScheme(
        code="NOS",
        name="National Overseas Scholarship",
        config=nos_config,
        is_active=True,
    )
    scheme_nfst = TestScheme(
        code="NFST",
        name="National Fellowship for ST",
        config=nfst_config,
        is_active=True,
    )
    db.add_all([scheme_nos, scheme_nfst])
    db.commit()

    # NOS applications
    # App 1: approved with 2 disbursements (50k disbursed, 25k pending) and 1 pending renewal
    app1 = TestApplication(
        scheme_id=scheme_nos.id,
        applicant_name="App 1 NOS",
        applicant_email="app1@test.com",
        current_state="approved",
    )
    # App 2: deficient with 1 DEFICIENT document
    app2 = TestApplication(
        scheme_id=scheme_nos.id,
        applicant_name="App 2 NOS",
        applicant_email="app2@test.com",
        current_state="deficient",
    )
    # App 3: submitted
    app3 = TestApplication(
        scheme_id=scheme_nos.id,
        applicant_name="App 3 NOS",
        applicant_email="app3@test.com",
        current_state="submitted",
    )

    # NFST applications
    # App 4: document_scrutiny
    app4 = TestApplication(
        scheme_id=scheme_nfst.id,
        applicant_name="App 4 NFST",
        applicant_email="app4@test.com",
        current_state="document_scrutiny",
    )
    # App 5: approved with 1 disbursement (30k disbursed)
    app5 = TestApplication(
        scheme_id=scheme_nfst.id,
        applicant_name="App 5 NFST",
        applicant_email="app5@test.com",
        current_state="approved",
    )
    db.add_all([app1, app2, app3, app4, app5])
    db.commit()

    # Documents
    # App 1 has 2 verified docs
    doc1 = TestDocument(application_id=app1.id, doc_type="caste_certificate", storage_key="k1", status="VERIFIED")
    doc2 = TestDocument(application_id=app1.id, doc_type="income_certificate", storage_key="k2", status="VERIFIED")
    # App 2 has 1 deficient doc
    doc3 = TestDocument(application_id=app2.id, doc_type="caste_certificate", storage_key="k3", status="DEFICIENT")
    # App 3 has 1 pending doc
    doc4 = TestDocument(application_id=app3.id, doc_type="caste_certificate", storage_key="k4", status="PENDING")
    # App 4 has 1 pending doc
    doc5 = TestDocument(application_id=app4.id, doc_type="caste_certificate", storage_key="k5", status="PENDING")
    db.add_all([doc1, doc2, doc3, doc4, doc5])

    # Disbursements
    disb1 = TestDisbursement(
        application_id=app1.id,
        amount=50000.0,
        status="DISBURSED",
        disbursed_date=date.today(),
        installment_number=1,
    )
    disb2 = TestDisbursement(
        application_id=app1.id,
        amount=25000.0,
        status="PENDING",
        installment_number=2,
    )
    disb3 = TestDisbursement(
        application_id=app5.id,
        amount=30000.0,
        status="DISBURSED",
        disbursed_date=date.today(),
        installment_number=1,
    )
    db.add_all([disb1, disb2, disb3])

    # Renewals
    ren1 = TestRenewal(
        application_id=app1.id,
        academic_year_or_cycle="2026-27",
        status="PENDING_REVIEW",
        due_date=date(2027, 4, 30),
    )
    db.add(ren1)
    db.commit()

    # Fetch Overview stats
    resp = auth_client.get("/api/stats/overview")
    assert resp.status_code == 200
    data = resp.json()

    assert data["total_applications"] == 5
    assert data["applications_by_scheme"] == {"NOS": 3, "NFST": 2}
    assert data["applications_by_state"]["approved"] == 2
    assert data["applications_by_state"]["deficient"] == 1
    assert data["applications_by_state"]["submitted"] == 1
    assert data["applications_by_state"]["document_scrutiny"] == 1

    assert data["deficient_count"] == 1
    assert data["documents_by_status"]["VERIFIED"] == 2
    assert data["documents_by_status"]["DEFICIENT"] == 1
    assert data["documents_by_status"]["PENDING"] == 2

    assert data["pending_disbursements_count"] == 1
    assert data["total_disbursed_amount"] == 80000.0
    assert data["pending_renewals_count"] == 1


def test_scheme_scoped_stats(auth_client, db):
    """Per-scheme stats endpoint returns accurately isolated counts for each scheme."""
    nos_config = load_fixture("nos_config.json")
    nfst_config = load_fixture("nfst_config.json")

    scheme_nos = TestScheme(code="NOS", name="NOS Scheme", config=nos_config, is_active=True)
    scheme_nfst = TestScheme(code="NFST", name="NFST Scheme", config=nfst_config, is_active=True)
    db.add_all([scheme_nos, scheme_nfst])
    db.commit()

    # NOS app
    app_nos = TestApplication(
        scheme_id=scheme_nos.id,
        applicant_name="NOS User",
        applicant_email="nos@test.com",
        current_state="approved",
    )
    # NFST app
    app_nfst = TestApplication(
        scheme_id=scheme_nfst.id,
        applicant_name="NFST User",
        applicant_email="nfst@test.com",
        current_state="submitted",
    )
    db.add_all([app_nos, app_nfst])
    db.commit()

    # NOS disbursement
    db.add(
        TestDisbursement(
            application_id=app_nos.id,
            amount=45000.0,
            status="DISBURSED",
            installment_number=1,
        )
    )
    # NFST disbursement
    db.add(
        TestDisbursement(
            application_id=app_nfst.id,
            amount=15000.0,
            status="PENDING",
            installment_number=1,
        )
    )
    db.commit()

    # 1. Query NOS stats
    nos_resp = auth_client.get(f"/api/stats/schemes/{scheme_nos.id}")
    assert nos_resp.status_code == 200
    nos_data = nos_resp.json()
    assert nos_data["total_applications"] == 1
    assert nos_data["applications_by_scheme"] == {"NOS": 1}
    assert nos_data["applications_by_state"] == {"approved": 1}
    assert nos_data["total_disbursed_amount"] == 45000.0
    assert nos_data["pending_disbursements_count"] == 0

    # 2. Query NFST stats
    nfst_resp = auth_client.get(f"/api/stats/schemes/{scheme_nfst.id}")
    assert nfst_resp.status_code == 200
    nfst_data = nfst_resp.json()
    assert nfst_data["total_applications"] == 1
    assert nfst_data["applications_by_scheme"] == {"NFST": 1}
    assert nfst_data["applications_by_state"] == {"submitted": 1}
    assert nfst_data["total_disbursed_amount"] == 0.0
    assert nfst_data["pending_disbursements_count"] == 1

    # 3. Non-existent scheme returns 404
    non_existent_id = uuid.uuid4()
    err_resp = auth_client.get(f"/api/stats/schemes/{non_existent_id}")
    assert err_resp.status_code == 404


def test_recent_activity_descending_and_capped_at_10(auth_client, db):
    """Recent activity feed returns the latest 10 AuditLog entries in descending order."""
    nos_config = load_fixture("nos_config.json")
    scheme = TestScheme(code="NOS", name="NOS", config=nos_config, is_active=True)
    db.add(scheme)
    db.commit()

    base_time = datetime(2026, 9, 19, 10, 0, 0, tzinfo=timezone.utc)
    # Create 15 audit logs with sequential timestamps
    for i in range(15):
        log = TestAuditLog(
            scheme_id=scheme.id,
            action=f"action_step_{i}",
            created_at=base_time + timedelta(minutes=i),
        )
        db.add(log)
    db.commit()

    resp = auth_client.get("/api/stats/overview")
    assert resp.status_code == 200
    activity = resp.json()["recent_activity"]

    assert len(activity) == 10
    # The newest action was action_step_14, followed by action_step_13 ... down to action_step_5
    assert activity[0]["action"] == "action_step_14"
    assert activity[1]["action"] == "action_step_13"
    assert activity[9]["action"] == "action_step_5"

    # Verify descending timestamp order
    timestamps = [item["created_at"] for item in activity]
    assert timestamps == sorted(timestamps, reverse=True)
