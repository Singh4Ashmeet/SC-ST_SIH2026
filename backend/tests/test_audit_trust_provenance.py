"""
test_audit_trust_provenance.py

Comprehensive tests for:
1. Cryptographic Hash Chain Audit Trail & Tamper Detection (Phase 14 & 15)
2. Document Trust Engine & Multi-signal Evidence Graph (Phase 5 & 6)
3. Decision Trace & Policy Decision Replay (Phase 8 & 22)
4. Dynamic Form Schema Validation (Phase 1 & 2)
"""

import uuid
from datetime import datetime, timezone, timedelta
import pytest
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker

from app.core.database import Base
from app.models.application import Application
from app.models.audit_log import AuditLog
from app.models.document import Document, DocumentStatus
from app.models.scheme import Scheme
from app.models.user import User, UserRole
from app.schemas.scheme_config import FormSchema, FormFieldSchema, SchemeConfig
from app.services.audit_service import (
    create_audit_log,
    verify_hash_chain,
    simulate_tampering,
    restore_tampering,
    recompute_all_hashes,
    GENESIS_HASH,
)
from app.services.document_trust_engine import (
    evaluate_document_trust,
    build_evidence_graph,
)
from app.services.policy_simulation_engine import (
    build_decision_trace,
    replay_application_decision,
)


@pytest.fixture
def sqlite_db():
    engine = create_engine("sqlite:///:memory:")
    Base.metadata.create_all(bind=engine)
    TestingSession = sessionmaker(bind=engine)
    db = TestingSession()
    try:
        yield db
    finally:
        db.close()


# ── 1. Cryptographic Hash Chain Tests ─────────────────────────────────────────

def test_hash_chain_creation_and_verification(sqlite_db):
    """Test append-only SHA-256 hash chaining from genesis block."""
    app_id = uuid.uuid4()

    # Create 3 sequential audit logs
    log1 = create_audit_log(
        sqlite_db,
        action="application_created",
        application_id=app_id,
        details={"channel": "web_portal"},
    )
    sqlite_db.commit()

    assert log1.previous_hash == GENESIS_HASH
    assert log1.current_hash is not None
    assert len(log1.current_hash) == 64

    log2 = create_audit_log(
        sqlite_db,
        action="transition",
        application_id=app_id,
        from_state="submitted",
        to_state="eligibility_check",
    )
    sqlite_db.commit()

    assert log2.previous_hash == log1.current_hash

    log3 = create_audit_log(
        sqlite_db,
        action="eligibility_check_passed",
        application_id=app_id,
        from_state="eligibility_check",
        to_state="document_scrutiny",
    )
    sqlite_db.commit()

    assert log3.previous_hash == log2.current_hash

    # Verify chain
    result = verify_hash_chain(sqlite_db)
    assert result["status"] == "VERIFIED"
    assert result["events_checked"] == 3
    assert result["broken_links"] == 0
    assert result["invalid_hashes"] == 0
    assert result["tamper_detected"] is False


def test_audit_tamper_detection_and_recovery(sqlite_db):
    """Test that unauthorized database modifications are detected by verify_hash_chain."""
    for i in range(4):
        create_audit_log(sqlite_db, action=f"step_{i}", details={"step": i})
        sqlite_db.commit()

    # Pristine verification
    res_pristine = verify_hash_chain(sqlite_db)
    assert res_pristine["status"] == "VERIFIED"

    # Simulate tampering
    tamper_info = simulate_tampering(sqlite_db)
    assert tamper_info["tampered_event_id"] is not None

    # Verification must now fail
    res_tampered = verify_hash_chain(sqlite_db)
    assert res_tampered["status"] == "TAMPER_DETECTED"
    assert res_tampered["tamper_detected"] is True
    assert res_tampered["invalid_hashes"] >= 1

    # Restore tampering
    restore_info = restore_tampering(sqlite_db)
    assert restore_info["repaired_count"] == 4

    # Verification must now pass
    res_restored = verify_hash_chain(sqlite_db)
    assert res_restored["status"] == "VERIFIED"
    assert res_restored["invalid_hashes"] == 0


# ── 2. Document Trust Engine & Evidence Graph Tests ───────────────────────────

def test_document_trust_evaluation(sqlite_db):
    """Test explainable multi-signal document trust scoring."""
    app = Application(
        id=uuid.uuid4(),
        applicant_name="Sunil Marandi",
        applicant_email="sunil@example.com",
        current_state="submitted",
        applicant_data={"annual_income": 350000},
    )
    doc = Document(
        id=uuid.uuid4(),
        application_id=app.id,
        doc_type="income_certificate",
        storage_key="test_income.pdf",
        status=DocumentStatus.VERIFIED,
        extracted_fields={
            "applicant_name": "Sunil Marandi",
            "annual_income": "350000",
            "issue_date": (datetime.now(timezone.utc) - timedelta(days=30)).strftime("%Y-%m-%d"),
            "issuing_authority": "Tehsildar",
        },
    )

    trust = evaluate_document_trust(doc, app, None, [doc])
    assert trust["trust_score"] >= 80
    assert trust["overall_trust_status"] in ["VERIFIED", "REVIEW_REQUIRED", "NEEDS_SCRUTINY"]
    signals = {s["name"]: s["status"] for s in trust["signals"]}
    assert signals.get("Document Type Confidence") == "PASS"
    assert signals.get("Applicant Name Consistency") == "PASS"
    assert signals.get("Annual Income Extraction") == "PASS"


def test_evidence_consistency_graph(sqlite_db):
    """Test cross-document entity comparison in build_evidence_graph."""
    app = Application(
        id=uuid.uuid4(),
        applicant_name="Sunil Marandi",
        current_state="submitted",
        applicant_data={"annual_income": 400000},
    )
    doc1 = Document(
        id=uuid.uuid4(),
        application_id=app.id,
        doc_type="income_certificate",
        storage_key="doc1.pdf",
        extracted_fields={"applicant_name": "Sunil Marandi", "annual_income": "400000"},
    )
    doc2 = Document(
        id=uuid.uuid4(),
        application_id=app.id,
        doc_type="caste_certificate",
        storage_key="doc2.pdf",
        extracted_fields={"applicant_name": "Sunil Marandi", "category": "ST"},
    )

    graph = build_evidence_graph(app, [doc1, doc2])
    assert graph["consistency_verdict"] == "PASS"
    assert len(graph["anomalies"]) == 0


# ── 3. Decision Trace & Decision Replay Tests ─────────────────────────────────

def test_decision_trace_and_replay(sqlite_db):
    """Test policy provenance decision trace and side-by-side counterfactual replay."""
    scheme = Scheme(
        id=uuid.uuid4(),
        code="NFST",
        name="National Fellowship for ST Students",
        config={
            "scheme_code": "NFST",
            "name": "National Fellowship for ST Students",
            "version": 1,
            "initial_state": "submitted",
            "workflow_states": [
                {"name": "submitted", "label": "Submitted"},
                {"name": "approved", "label": "Approved", "is_terminal": True},
            ],
            "workflow_transitions": [
                {"from_state": "submitted", "to_state": "approved", "trigger": "approve"},
            ],
            "required_documents": [],

            "eligibility_rules": [
                {
                    "field": "annual_income",
                    "condition": {"<=": [{"var": "annual_income"}, 600000]},
                    "failure_message": "Income exceeds INR 6,00,000",
                },
                {
                    "field": "category",
                    "condition": {"==": [{"var": "category"}, "ST"]},
                    "failure_message": "Category must be ST",
                },
            ],
        },
        is_active=True,
    )

    sqlite_db.add(scheme)
    sqlite_db.flush()

    app = Application(
        id=uuid.uuid4(),
        scheme_id=scheme.id,
        applicant_name="Kishore Murmu",
        applicant_email="kishore@example.com",
        current_state="submitted",
        applicant_data={"annual_income": 700000, "category": "ST"},
    )
    sqlite_db.add(app)
    sqlite_db.commit()

    # 1. Decision Trace
    trace = build_decision_trace(sqlite_db, app.id)
    assert trace["overall_result"] == "FAIL"  # Income 700000 > 600000
    assert len(trace["decision_trace"]) == 2
    income_rule = next(r for r in trace["decision_trace"] if r["field"] == "annual_income")
    assert income_rule["status"] == "FAIL"

    # 2. Decision Replay with relaxed income policy (8,00,000)
    proposed_cfg = {
        "eligibility_rules": [
            {
                "field": "annual_income",
                "condition": {"<=": [{"var": "annual_income"}, 800000]},
                "failure_message": "Income exceeds INR 8,00,000",
            },
            {
                "field": "category",
                "condition": {"==": [{"var": "category"}, "ST"]},
                "failure_message": "Category must be ST",
            },
        ]
    }
    replay = replay_application_decision(sqlite_db, app.id, proposed_config_dict=proposed_cfg)
    assert replay["historical_policy"]["decision"] == "INELIGIBLE"
    assert replay["current_policy"]["decision"] == "INELIGIBLE"
    assert replay["proposed_policy"]["decision"] == "ELIGIBLE"
    assert replay["verdict_changed"] is True


# ── 4. Dynamic Form Schema Validation Tests ───────────────────────────────────

def test_dynamic_form_schema_validation():
    """Test declarative FormSchema parsing within SchemeConfig."""
    raw_form = {
        "title": "Custom Fellowship Application Form",
        "description": "Dynamic form configuration",
        "fields": [
            {"key": "applicant_name", "label": "Full Name", "type": "text", "required": True},
            {"key": "annual_income", "label": "Annual Income", "type": "number", "required": True},
            {"key": "category", "label": "Social Category", "type": "select", "options": ["ST", "SC", "OBC"], "required": True},
            {"key": "admission_letter", "label": "Admission Letter", "type": "file", "required": False},
        ],
    }

    form_obj = FormSchema.model_validate(raw_form)
    assert len(form_obj.fields) == 4
    assert form_obj.fields[0].key == "applicant_name"
    assert form_obj.fields[2].options == ["ST", "SC", "OBC"]
