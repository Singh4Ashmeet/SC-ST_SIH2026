"""
Tests for EligibilityEngine: json-logic evaluation, missing fields,
multi-failure collection, and workflow integration.
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


# Test-specific models using SQLite-compatible types
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

    scheme: Mapped["TestScheme"] = relationship("TestScheme", back_populates="applications")
    audit_logs: Mapped[List["TestAuditLog"]] = relationship("TestAuditLog", back_populates="application", cascade="all, delete-orphan")


TestScheme.applications = relationship("TestApplication", back_populates="scheme", cascade="all, delete-orphan")


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

    application: Mapped[Optional["TestApplication"]] = relationship("TestApplication", back_populates="audit_logs")
    scheme: Mapped[Optional["TestScheme"]] = relationship("TestScheme")


# Test database setup
TEST_DB_URL = "sqlite:///./test_eligibility.db"
engine = create_engine(TEST_DB_URL, connect_args={"check_same_thread": False})
TestingSessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)


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


@pytest.fixture
def nfst_scheme(db) -> TestScheme:
    """Create an NFST scheme from fixture."""
    config_data = load_fixture("nfst_config.json")
    scheme = TestScheme(
        code="NFST",
        name="National Fellowship for ST Students",
        description="Test fellowship scheme",
        config=config_data,
        is_active=True,
    )
    db.add(scheme)
    db.commit()
    db.refresh(scheme)
    return scheme


@pytest.fixture
def nos_scheme(db) -> TestScheme:
    """Create a NOS scheme from fixture."""
    config_data = load_fixture("nos_config.json")
    scheme = TestScheme(
        code="NOS",
        name="National Overseas Scholarship",
        description="Test overseas scholarship scheme",
        config=config_data,
        is_active=True,
    )
    db.add(scheme)
    db.commit()
    db.refresh(scheme)
    return scheme


from app.services.workflow_engine import WorkflowEngine
from app.services.eligibility_engine import evaluate_eligibility, EligibilityResult
from app.schemas.scheme_config import SchemeConfig
from app.services.scheme_config_validator import validate_scheme_config


def test_fully_eligible_applicant_nfst(nfst_scheme):
    """Test that a fully eligible applicant passes all NFST rules."""
    config = validate_scheme_config(nfst_scheme.config)
    applicant_data = {
        "age": 25,
        "annual_income": 300000,
        "category": "ST"
    }
    result = evaluate_eligibility(config, applicant_data)
    assert result.passed is True
    assert result.failed_rules == []


def test_fully_eligible_applicant_nos(nos_scheme):
    """Test that a fully eligible applicant passes all NOS rules."""
    config = validate_scheme_config(nos_scheme.config)
    applicant_data = {
        "age": 30,
        "qualifying_exam_percent": 75,
        "admission_confirmed": True
    }
    result = evaluate_eligibility(config, applicant_data)
    assert result.passed is True
    assert result.failed_rules == []


def test_single_rule_failure_nfst(nfst_scheme):
    """Test applicant failing exactly one NFST rule (age too high)."""
    config = validate_scheme_config(nfst_scheme.config)
    applicant_data = {
        "age": 40,  # fails: must be <= 36
        "annual_income": 300000,
        "category": "ST"
    }
    result = evaluate_eligibility(config, applicant_data)
    assert result.passed is False
    assert len(result.failed_rules) == 1
    failed = result.failed_rules[0]
    assert failed.field == "age"
    assert "36" in failed.failure_message
    assert failed.condition == {"<=": [{"var": "age"}, 36]}


def test_single_rule_failure_nos(nos_scheme):
    """Test applicant failing exactly one NOS rule (percentage too low)."""
    config = validate_scheme_config(nos_scheme.config)
    applicant_data = {
        "age": 30,
        "qualifying_exam_percent": 50,  # fails: must be >= 60
        "admission_confirmed": True
    }
    result = evaluate_eligibility(config, applicant_data)
    assert result.passed is False
    assert len(result.failed_rules) == 1
    failed = result.failed_rules[0]
    assert failed.field == "qualifying_exam_percent"
    assert "60%" in failed.failure_message


def test_multiple_rule_failures_nfst(nfst_scheme):
    """Test applicant failing multiple NFST rules simultaneously."""
    config = validate_scheme_config(nfst_scheme.config)
    applicant_data = {
        "age": 40,           # fails: must be <= 36
        "annual_income": 800000,  # fails: must be <= 600000
        "category": "OBC"    # fails: must be "ST"
    }
    result = evaluate_eligibility(config, applicant_data)
    assert result.passed is False
    assert len(result.failed_rules) == 3
    failed_fields = {fr.field for fr in result.failed_rules}
    assert failed_fields == {"age", "annual_income", "category"}
    # Check all failure messages are present
    messages = [fr.failure_message for fr in result.failed_rules]
    assert any("36" in m for m in messages)
    assert any("6,00,000" in m for m in messages)
    assert any("ST" in m for m in messages)


def test_multiple_rule_failures_nos(nos_scheme):
    """Test applicant failing multiple NOS rules simultaneously."""
    config = validate_scheme_config(nos_scheme.config)
    applicant_data = {
        "age": 40,                    # fails: must be <= 35
        "qualifying_exam_percent": 50,  # fails: must be >= 60
        "admission_confirmed": False    # fails: must be true
    }
    result = evaluate_eligibility(config, applicant_data)
    assert result.passed is False
    assert len(result.failed_rules) == 3
    failed_fields = {fr.field for fr in result.failed_rules}
    assert failed_fields == {"age", "qualifying_exam_percent", "admission_confirmed"}


def test_missing_field_treated_as_failure(nfst_scheme):
    """Test that missing required field is treated as failure, not exception."""
    config = validate_scheme_config(nfst_scheme.config)
    applicant_data = {
        "age": 25,
        "annual_income": 300000
        # "category" is missing entirely
    }
    result = evaluate_eligibility(config, applicant_data)
    assert result.passed is False
    # Should have 1 failure for the missing field
    assert len(result.failed_rules) == 1
    failed = result.failed_rules[0]
    assert failed.field == "category"
    assert "Missing required field: category" in failed.failure_message


def test_missing_multiple_fields(nfst_scheme):
    """Test that multiple missing fields all generate failures."""
    config = validate_scheme_config(nfst_scheme.config)
    applicant_data = {
        "age": 25
        # missing annual_income and category
    }
    result = evaluate_eligibility(config, applicant_data)
    assert result.passed is False
    assert len(result.failed_rules) == 2
    failed_fields = {fr.field for fr in result.failed_rules}
    assert failed_fields == {"annual_income", "category"}
    for fr in result.failed_rules:
        assert "Missing required field" in fr.failure_message


def test_evaluate_eligibility_no_rules():
    """Test that empty eligibility rules always passes."""
    config_data = {
        "scheme_code": "TEST",
        "version": 1,
        "eligibility_rules": [],
        "required_documents": [],
        "workflow_states": [
            {"name": "submitted", "label": "Submitted", "is_terminal": False},
            {"name": "approved", "label": "Approved", "is_terminal": True}
        ],
        "workflow_transitions": [
            {"from_state": "submitted", "to_state": "approved", "trigger": "approve", "allowed_roles": []}
        ],
        "initial_state": "submitted"
    }
    config = validate_scheme_config(config_data)
    applicant_data = {"any": "data"}
    result = evaluate_eligibility(config, applicant_data)
    assert result.passed is True
    assert result.failed_rules == []


def test_evaluate_eligibility_with_nested_logic():
    """Test json-logic evaluation with nested conditions (and/or)."""
    config_data = {
        "scheme_code": "TEST",
        "version": 1,
        "eligibility_rules": [
            {
                "field": "age_and_income",
                "condition": {
                    "and": [
                        {"<=": [{"var": "age"}, 30]},
                        {"<=": [{"var": "income"}, 500000]}
                    ]
                },
                "failure_message": "Must be 30 or younger AND income 500k or less"
            }
        ],
        "required_documents": [],
        "workflow_states": [
            {"name": "submitted", "label": "Submitted", "is_terminal": False},
            {"name": "approved", "label": "Approved", "is_terminal": True}
        ],
        "workflow_transitions": [
            {"from_state": "submitted", "to_state": "approved", "trigger": "approve", "allowed_roles": []}
        ],
        "initial_state": "submitted"
    }
    config = validate_scheme_config(config_data)

    # Pass both
    result = evaluate_eligibility(config, {"age": 25, "income": 400000})
    assert result.passed is True

    # Fail age
    result = evaluate_eligibility(config, {"age": 35, "income": 400000})
    assert result.passed is False
    assert len(result.failed_rules) == 1

    # Fail income
    result = evaluate_eligibility(config, {"age": 25, "income": 600000})
    assert result.passed is False
    assert len(result.failed_rules) == 1

    # Fail both (but it's one rule, so one failure)
    result = evaluate_eligibility(config, {"age": 35, "income": 600000})
    assert result.passed is False
    assert len(result.failed_rules) == 1


def test_end_to_end_eligibility_check_pass(nfst_scheme, db):
    """End-to-end test: eligible applicant transitions to document_scrutiny."""
    config = validate_scheme_config(nfst_scheme.config)
    app = TestApplication(
        scheme_id=nfst_scheme.id,
        applicant_name="Eligible Applicant",
        applicant_email="eligible@example.com",
        applicant_data={"age": 25, "annual_income": 300000, "category": "ST"},
        current_state=config.initial_state,
    )
    db.add(app)
    db.commit()
    db.refresh(app)

    # Create initial audit log
    audit_log = TestAuditLog(
        application_id=app.id,
        scheme_id=nfst_scheme.id,
        actor_user_id=None,
        action="application_created",
        from_state=None,
        to_state=config.initial_state,
        details={"applicant_data": {"age": 25, "annual_income": 300000, "category": "ST"}},
    )
    db.add(audit_log)
    db.commit()

    engine = WorkflowEngine(db)

    # First move to eligibility_check state (auto_evaluate)
    app = engine.apply_transition(app, "auto_evaluate", actor_user_id=None)
    assert app.current_state == "eligibility_check"

    # Now run eligibility check - should pass
    updated_app, result = engine.run_eligibility_check(app)

    assert result.passed is True
    assert result.failed_rules == []
    assert updated_app.current_state == "document_scrutiny"

    # Verify audit log has the eligibility_passed transition
    logs = db.query(TestAuditLog).filter(TestAuditLog.application_id == app.id).all()
    transition_logs = [log for log in logs if log.action == "state_transition"]
    assert len(transition_logs) == 2  # auto_evaluate + eligibility_passed
    eligibility_log = next(log for log in transition_logs if log.to_state == "document_scrutiny")
    assert eligibility_log.from_state == "eligibility_check"
    assert eligibility_log.to_state == "document_scrutiny"
    assert eligibility_log.details["source"] == "auto_eligibility_check"


def test_end_to_end_eligibility_check_fail(nfst_scheme, db):
    """End-to-end test: ineligible applicant transitions to rejected with failed_rules in audit."""
    config = validate_scheme_config(nfst_scheme.config)
    app = TestApplication(
        scheme_id=nfst_scheme.id,
        applicant_name="Ineligible Applicant",
        applicant_email="ineligible@example.com",
        applicant_data={"age": 40, "annual_income": 800000, "category": "OBC"},
        current_state=config.initial_state,
    )
    db.add(app)
    db.commit()
    db.refresh(app)

    # Create initial audit log
    audit_log = TestAuditLog(
        application_id=app.id,
        scheme_id=nfst_scheme.id,
        actor_user_id=None,
        action="application_created",
        from_state=None,
        to_state=config.initial_state,
        details={"applicant_data": {"age": 40, "annual_income": 800000, "category": "OBC"}},
    )
    db.add(audit_log)
    db.commit()

    engine = WorkflowEngine(db)

    # First move to eligibility_check state (auto_evaluate)
    app = engine.apply_transition(app, "auto_evaluate", actor_user_id=None)
    assert app.current_state == "eligibility_check"

    # Now run eligibility check - should fail
    updated_app, result = engine.run_eligibility_check(app)

    assert result.passed is False
    assert len(result.failed_rules) == 3
    assert updated_app.current_state == "rejected"

    # Verify audit log has the eligibility_failed transition with failed_rules
    logs = db.query(TestAuditLog).filter(TestAuditLog.application_id == app.id).all()
    transition_logs = [log for log in logs if log.action == "state_transition"]
    assert len(transition_logs) == 2  # auto_evaluate + eligibility_failed
    failed_log = next(log for log in transition_logs if log.to_state == "rejected")
    assert failed_log.from_state == "eligibility_check"
    assert failed_log.to_state == "rejected"
    assert failed_log.details["source"] == "auto_eligibility_check"
    assert "failed_rules" in failed_log.details
    assert len(failed_log.details["failed_rules"]) == 3
    failed_fields = {fr["field"] for fr in failed_log.details["failed_rules"]}
    assert failed_fields == {"age", "annual_income", "category"}


def test_run_eligibility_check_wrong_state_raises_error(nfst_scheme, db):
    """Test that run_eligibility_check raises error when not in eligibility_check state."""
    config = validate_scheme_config(nfst_scheme.config)
    app = TestApplication(
        scheme_id=nfst_scheme.id,
        applicant_name="Test Applicant",
        applicant_email="test@example.com",
        applicant_data={"age": 25, "annual_income": 300000, "category": "ST"},
        current_state=config.initial_state,  # submitted, not eligibility_check
    )
    db.add(app)
    db.commit()
    db.refresh(app)

    engine = WorkflowEngine(db)

    with pytest.raises(Exception) as exc_info:
        engine.run_eligibility_check(app)

    assert "Eligibility check not available from state 'submitted'" in str(exc_info.value)


def test_run_eligibility_check_after_already_passed(nfst_scheme, db):
    """Test that run_eligibility_check raises error if already past eligibility_check."""
    config = validate_scheme_config(nfst_scheme.config)
    app = TestApplication(
        scheme_id=nfst_scheme.id,
        applicant_name="Test Applicant",
        applicant_email="test@example.com",
        applicant_data={"age": 25, "annual_income": 300000, "category": "ST"},
        current_state="document_scrutiny",  # Already past eligibility_check
    )
    db.add(app)
    db.commit()
    db.refresh(app)

    engine = WorkflowEngine(db)

    with pytest.raises(Exception) as exc_info:
        engine.run_eligibility_check(app)

    assert "Eligibility check not available from state 'document_scrutiny'" in str(exc_info.value)