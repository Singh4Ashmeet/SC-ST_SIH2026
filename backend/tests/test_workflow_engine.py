"""
Tests for WorkflowEngine: dynamic state machine, transitions, audit logging.
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


import pytest
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker

from app.services.workflow_engine import WorkflowEngine, InvalidTransitionError, build_state_machine
from app.schemas.scheme_config import SchemeConfig
from app.services.scheme_config_validator import validate_scheme_config


# Test database setup
TEST_DB_URL = "sqlite:///./test_workflow.db"
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
def application(db, nfst_scheme) -> TestApplication:
    """Create an application in the initial state."""
    config = validate_scheme_config(nfst_scheme.config)
    app = TestApplication(
        scheme_id=nfst_scheme.id,
        applicant_name="Test Applicant",
        applicant_email="test@example.com",
        applicant_data={"age": 25, "annual_income": 300000, "category": "ST"},
        current_state=config.initial_state,
    )
    db.add(app)
    db.commit()
    db.refresh(app)
    return app


def test_build_state_machine_from_config(nfst_scheme):
    """Test that a state machine can be built dynamically from scheme config."""
    config = validate_scheme_config(nfst_scheme.config)
    machine = build_state_machine(config)

    # Check initial state
    assert machine.current_state_value == "submitted"

    # Check all states exist in states_map
    expected_states = [
        "submitted", "eligibility_check", "document_scrutiny", "deficient",
        "selection", "approved", "disbursed", "rejected"
    ]
    for state_name in expected_states:
        assert state_name in machine.states_map

    # Check terminal states
    assert machine.states_map["disbursed"].final is True
    assert machine.states_map["rejected"].final is True
    assert machine.states_map["submitted"].final is False


def test_full_valid_path_nfst(db, nfst_scheme):
    """Walk an application through a full valid path to a terminal state."""
    # Create application
    config = validate_scheme_config(nfst_scheme.config)
    app = TestApplication(
        scheme_id=nfst_scheme.id,
        applicant_name="Test Applicant",
        applicant_email="test@example.com",
        applicant_data={"age": 25, "annual_income": 300000, "category": "ST"},
        current_state=config.initial_state,
    )
    db.add(app)
    db.commit()
    db.refresh(app)

    # Create initial audit log (normally done by API)
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

    # Initial state should be "submitted"
    assert engine.get_current_state(app) == "submitted"

    # Check available transitions from submitted (system-triggered)
    transitions = engine.get_available_transitions(app, user_role=None)
    assert len(transitions) == 1
    assert transitions[0].trigger == "auto_evaluate"

    # Apply auto_evaluate (system) -> eligibility_check
    app = engine.apply_transition(app, "auto_evaluate", actor_user_id=None)
    assert app.current_state == "eligibility_check"

    # Verify audit log created
    logs = db.query(TestAuditLog).filter(TestAuditLog.application_id == app.id).all()
    assert len(logs) == 2  # application_created + state_transition
    assert logs[1].action == "state_transition"
    assert logs[1].from_state == "submitted"
    assert logs[1].to_state == "eligibility_check"

    # From eligibility_check, two transitions available (system)
    transitions = engine.get_available_transitions(app, user_role=None)
    triggers = [t.trigger for t in transitions]
    assert "eligibility_passed" in triggers
    assert "eligibility_failed" in triggers

    # Apply eligibility_passed -> document_scrutiny
    app = engine.apply_transition(app, "eligibility_passed", actor_user_id=None)
    assert app.current_state == "document_scrutiny"

    # From document_scrutiny, role-gated transitions
    # Without role, no transitions available
    transitions = engine.get_available_transitions(app, user_role=None)
    assert len(transitions) == 0

    # With SCRUTINY_OFFICER role
    transitions = engine.get_available_transitions(app, user_role="SCRUTINY_OFFICER")
    triggers = [t.trigger for t in transitions]
    assert "documents_verified" in triggers
    assert "documents_flagged_deficient" in triggers

    # Apply documents_verified -> selection
    app = engine.apply_transition(
        app, "documents_verified", actor_user_id=uuid.uuid4(), details={"officer": "test"}
    )
    assert app.current_state == "selection"

    # From selection, role-gated transitions
    transitions = engine.get_available_transitions(app, user_role="SELECTION_COMMITTEE")
    triggers = [t.trigger for t in transitions]
    assert "committee_approved" in triggers
    assert "committee_rejected" in triggers

    # Apply committee_approved -> approved
    app = engine.apply_transition(
        app, "committee_approved", actor_user_id=uuid.uuid4()
    )
    assert app.current_state == "approved"

    # From approved, role-gated transition to disbursed
    transitions = engine.get_available_transitions(app, user_role="SCHEME_ADMIN")
    triggers = [t.trigger for t in transitions]
    assert "disbursed" in triggers

    # Apply disbursed -> disbursed (terminal)
    app = engine.apply_transition(
        app, "disbursed", actor_user_id=uuid.uuid4()
    )
    assert app.current_state == "disbursed"

    # Verify terminal state reached
    assert engine.get_current_state(app) == "disbursed"

    # Verify all audit logs
    logs = db.query(TestAuditLog).filter(TestAuditLog.application_id == app.id).all()
    actions = [log.action for log in logs]
    assert actions.count("state_transition") == 5  # 5 transitions
    assert actions.count("application_created") == 1


def test_invalid_trigger_raises_error(db, nfst_scheme):
    """Test that applying an invalid trigger raises InvalidTransitionError."""
    config = validate_scheme_config(nfst_scheme.config)
    app = TestApplication(
        scheme_id=nfst_scheme.id,
        applicant_name="Test Applicant",
        applicant_email="test@example.com",
        applicant_data={"age": 25, "annual_income": 300000, "category": "ST"},
        current_state=config.initial_state,
    )
    db.add(app)
    db.commit()
    db.refresh(app)

    # Create initial audit log (normally done by API)
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

    # Try to apply a trigger not available from "submitted"
    with pytest.raises(InvalidTransitionError) as exc_info:
        engine.apply_transition(app, "eligibility_passed", actor_user_id=None)

    assert exc_info.value.current_state == "submitted"
    assert exc_info.value.trigger == "eligibility_passed"

    # Verify state unchanged
    db.refresh(app)
    assert app.current_state == "submitted"

    # Verify no additional audit log (only application_created)
    logs = db.query(TestAuditLog).filter(TestAuditLog.application_id == app.id).all()
    assert len(logs) == 1
    assert logs[0].action == "application_created"


def test_role_gated_transition_rejected_without_role(db, nfst_scheme):
    """Test that role-gated transition is rejected when user has wrong/no role."""
    config = validate_scheme_config(nfst_scheme.config)
    app = TestApplication(
        scheme_id=nfst_scheme.id,
        applicant_name="Test Applicant",
        applicant_email="test@example.com",
        applicant_data={"age": 25, "annual_income": 300000, "category": "ST"},
        current_state=config.initial_state,
    )
    db.add(app)
    db.commit()
    db.refresh(app)

    engine = WorkflowEngine(db)

    # Advance to document_scrutiny (state with role-gated transitions)
    app = engine.apply_transition(app, "auto_evaluate", actor_user_id=None)
    app = engine.apply_transition(app, "eligibility_passed", actor_user_id=None)
    assert app.current_state == "document_scrutiny"

    # Try to apply documents_verified without role - should not be available
    transitions = engine.get_available_transitions(app, user_role=None)
    assert len(transitions) == 0

    # Try with wrong role
    transitions = engine.get_available_transitions(app, user_role="WRONG_ROLE")
    assert len(transitions) == 0

    # Now apply with correct role
    transitions = engine.get_available_transitions(app, user_role="SCRUTINY_OFFICER")
    assert len(transitions) == 2

    # Apply the transition with correct role
    app = engine.apply_transition(
        app, "documents_verified", actor_user_id=uuid.uuid4()
    )
    assert app.current_state == "selection"


def test_alternate_path_to_rejected(db, nfst_scheme):
    """Test alternate path: eligibility_failed -> rejected (terminal)."""
    config = validate_scheme_config(nfst_scheme.config)
    app = TestApplication(
        scheme_id=nfst_scheme.id,
        applicant_name="Test Applicant",
        applicant_email="test@example.com",
        applicant_data={"age": 25, "annual_income": 300000, "category": "ST"},
        current_state=config.initial_state,
    )
    db.add(app)
    db.commit()
    db.refresh(app)

    engine = WorkflowEngine(db)

    # Advance to eligibility_check
    app = engine.apply_transition(app, "auto_evaluate", actor_user_id=None)
    assert app.current_state == "eligibility_check"

    # Apply eligibility_failed -> rejected
    app = engine.apply_transition(app, "eligibility_failed", actor_user_id=None)
    assert app.current_state == "rejected"

    # rejected is terminal - no transitions available
    transitions = engine.get_available_transitions(app, user_role=None)
    assert len(transitions) == 0

    # Verify audit trail
    logs = db.query(TestAuditLog).filter(TestAuditLog.application_id == app.id).all()
    transitions_logs = [log for log in logs if log.action == "state_transition"]
    assert len(transitions_logs) == 2
    assert transitions_logs[0].from_state == "submitted"
    assert transitions_logs[0].to_state == "eligibility_check"
    assert transitions_logs[1].from_state == "eligibility_check"
    assert transitions_logs[1].to_state == "rejected"


def test_deficient_resubmit_cycle(db, nfst_scheme):
    """Test the deficient -> document_scrutiny -> deficient cycle."""
    config = validate_scheme_config(nfst_scheme.config)
    app = TestApplication(
        scheme_id=nfst_scheme.id,
        applicant_name="Test Applicant",
        applicant_email="test@example.com",
        applicant_data={"age": 25, "annual_income": 300000, "category": "ST"},
        current_state=config.initial_state,
    )
    db.add(app)
    db.commit()
    db.refresh(app)

    engine = WorkflowEngine(db)

    # Advance to document_scrutiny
    app = engine.apply_transition(app, "auto_evaluate", actor_user_id=None)
    app = engine.apply_transition(app, "eligibility_passed", actor_user_id=None)
    assert app.current_state == "document_scrutiny"

    # Flag as deficient
    app = engine.apply_transition(
        app, "documents_flagged_deficient", actor_user_id=uuid.uuid4(),
        details={"missing_docs": ["income_certificate"]}
    )
    assert app.current_state == "deficient"

    # Verify audit log has details
    logs = db.query(TestAuditLog).filter(TestAuditLog.application_id == app.id).all()
    deficient_log = next(log for log in logs if log.to_state == "deficient")
    assert deficient_log.details["missing_docs"] == ["income_certificate"]

    # Resubmit -> back to document_scrutiny
    app = engine.apply_transition(app, "resubmitted", actor_user_id=None)
    assert app.current_state == "document_scrutiny"

    # Can flag deficient again
    app = engine.apply_transition(
        app, "documents_flagged_deficient", actor_user_id=uuid.uuid4()
    )
    assert app.current_state == "deficient"

    # Resubmit again
    app = engine.apply_transition(app, "resubmitted", actor_user_id=None)
    assert app.current_state == "document_scrutiny"


def test_nos_scheme_different_workflow(db):
    """Test that NOS scheme with different workflow works correctly."""
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

    config = validate_scheme_config(scheme.config)
    app = TestApplication(
        scheme_id=scheme.id,
        applicant_name="Test Applicant",
        applicant_email="test@example.com",
        applicant_data={"age": 30, "qualifying_exam_percent": 75, "admission_confirmed": True},
        current_state=config.initial_state,
    )
    db.add(app)
    db.commit()
    db.refresh(app)

    engine = WorkflowEngine(db)

    # Initial state
    assert engine.get_current_state(app) == "submitted"

    # Different transition names for NOS
    transitions = engine.get_available_transitions(app, user_role=None)
    assert len(transitions) == 1
    assert transitions[0].trigger == "start_automated_check"

    # Advance through NOS workflow
    app = engine.apply_transition(app, "start_automated_check", actor_user_id=None)
    assert app.current_state == "eligibility_check"

    app = engine.apply_transition(app, "eligibility_passed", actor_user_id=None)
    assert app.current_state == "document_scrutiny"

    # NOS has different terminal state: visa_issued
    app = engine.apply_transition(
        app, "documents_verified", actor_user_id=uuid.uuid4()
    )
    assert app.current_state == "selection"

    app = engine.apply_transition(
        app, "committee_approved", actor_user_id=uuid.uuid4()
    )
    assert app.current_state == "approved"

    app = engine.apply_transition(
        app, "grant_issued", actor_user_id=uuid.uuid4()
    )
    assert app.current_state == "visa_issued"

    # visa_issued is terminal
    transitions = engine.get_available_transitions(app, user_role=None)
    assert len(transitions) == 0