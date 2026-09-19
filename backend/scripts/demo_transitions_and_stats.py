"""
Demonstration script to trigger real state transitions on a test application,
capturing notification log outputs and generating the resulting stats overview JSON.
"""

from datetime import date, datetime
import json
import logging
from pathlib import Path
import sys
import uuid

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

# Configure logging to show notification output clearly in terminal
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(name)s - %(message)s",
    handlers=[logging.StreamHandler(sys.stdout)],
)

from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker

from app.models.base import Base
from app.models.user import User, UserRole
from app.models.scheme import Scheme
from app.models.application import Application
from app.models.document import Document, DocumentStatus
from app.models.disbursement import Disbursement, DisbursementStatus
from app.models.renewal import Renewal, RenewalStatus
from app.models.audit_log import AuditLog
from app.services.workflow_engine import WorkflowEngine
from app.services.notification_service import notification_service, NotificationEvent
from app.api.stats import _compute_stats


def run_demo():
    print("=" * 80)
    print("DEMO: APPLICATION LIFECYCLE TRANSITIONS, NOTIFICATIONS & STATS OVERVIEW")
    print("=" * 80)

    # Use in-memory SQLite database
    engine = create_engine("sqlite:///:memory:", echo=False)
    Base.metadata.create_all(bind=engine)
    Session = sessionmaker(bind=engine)
    db = Session()

    # Load scheme fixtures
    fixtures_dir = Path(__file__).resolve().parent.parent / "app" / "fixtures"
    with open(fixtures_dir / "nos_config.json", "r", encoding="utf-8") as f:
        nos_config = json.load(f)
    with open(fixtures_dir / "nfst_config.json", "r", encoding="utf-8") as f:
        nfst_config = json.load(f)

    officer = User(
        email="committee_lead@gov.in",
        hashed_password="dummy",
        full_name="Dr. K. Sharma",
        role=UserRole.SELECTION_COMMITTEE,
        is_active=True,
    )
    db.add(officer)
    db.commit()

    scheme_nos = Scheme(
        code="NOS",
        name="National Overseas Scholarship",
        description="Overseas masters and doctoral studies scholarship",
        config=nos_config,
        is_active=True,
        created_by=officer.id,
    )
    scheme_nfst = Scheme(
        code="NFST",
        name="National Fellowship for Higher Education of ST Students",
        description="Fellowship for M.Phil and Ph.D. ST scholars",
        config=nfst_config,
        is_active=True,
        created_by=officer.id,
    )
    db.add_all([scheme_nos, scheme_nfst])
    db.commit()

    wf_engine = WorkflowEngine(db)

    # =========================================================================
    # APPLICATION 1: Successful Path (Eligible -> Verified -> Approved -> Disbursed -> Renewal)
    # =========================================================================
    print("\n" + "=" * 80)
    print(">> CASE 1: Successful Application (Ananya Bharti - NOS)")
    print("=" * 80)
    app1 = Application(
        scheme_id=scheme_nos.id,
        applicant_name="Ananya Bharti",
        applicant_email="ananya.bharti@scholar.in",
        applicant_phone="+91-9876543210",
        applicant_data={
            "age": 26,
            "qualifying_exam_percent": 82.5,
            "admission_confirmed": True,
        },
        current_state="submitted",
    )
    db.add(app1)
    db.commit()
    db.refresh(app1)

    print("\n[Step 1.1] Application Submission:")
    notification_service.notify(
        NotificationEvent.APPLICATION_SUBMITTED,
        app1,
        {"scheme_code": "NOS"},
    )

    print("\n[Step 1.2] Automated Eligibility Check:")
    app1 = wf_engine.apply_transition(app1, "start_automated_check", actor_user_id=None)
    app1, el_res1 = wf_engine.run_eligibility_check(app1)
    print(f"Eligibility Result: Passed={el_res1.passed} | State: {app1.current_state}")

    print("\n[Step 1.3] Document Scrutiny & Verification:")
    doc1 = Document(
        application_id=app1.id,
        doc_type="passport",
        storage_key="docs/passport_ananya.pdf",
        status=DocumentStatus.VERIFIED,
    )
    doc2 = Document(
        application_id=app1.id,
        doc_type="admission_letter",
        storage_key="docs/admission_oxford.pdf",
        status=DocumentStatus.VERIFIED,
    )
    doc3 = Document(
        application_id=app1.id,
        doc_type="degree_transcript",
        storage_key="docs/transcripts_delhi.pdf",
        status=DocumentStatus.VERIFIED,
    )
    db.add_all([doc1, doc2, doc3])
    db.commit()

    # Move to selection
    app1 = wf_engine.apply_transition(app1, "documents_verified", actor_user_id=officer.id)
    print(f"Documents Scrutiny: Verified | State: {app1.current_state}")

    print("\n[Step 1.4] Selection Committee Decision:")
    app1 = wf_engine.apply_transition(app1, "committee_approved", actor_user_id=officer.id)
    print(f"Selection Decision: Approved | State: {app1.current_state}")

    print("\n[Step 1.5] Disbursement Execution:")
    disb1 = Disbursement(
        application_id=app1.id,
        amount=150000.0,
        status=DisbursementStatus.DISBURSED,
        disbursed_date=date.today(),
        installment_number=1,
        remarks="Tranche 1 living + tuition fees transferred via PFMS",
        created_by=officer.id,
    )
    db.add(disb1)
    db.commit()

    notification_service.notify(
        NotificationEvent.DISBURSEMENT_COMPLETED,
        app1,
        {"disbursement_id": str(disb1.id), "amount": 150000.0, "installment_number": 1},
    )

    print("\n[Step 1.6] Renewal Review Cycle Initiation:")
    ren1 = Renewal(
        application_id=app1.id,
        academic_year_or_cycle="2026-27",
        status=RenewalStatus.PENDING_REVIEW,
        due_date=date(2027, 4, 30),
        remarks="Year 2 continuation review",
    )
    db.add(ren1)
    db.commit()

    notification_service.notify(
        NotificationEvent.RENEWAL_DUE,
        app1,
        {"renewal_id": str(ren1.id), "due_date": "2027-04-30"},
    )

    # =========================================================================
    # APPLICATION 2: Ineligible Path (Eligibility Fails)
    # =========================================================================
    print("\n" + "=" * 80)
    print(">> CASE 2: Ineligible Application (Rohan Meena - NOS)")
    print("=" * 80)
    app2 = Application(
        scheme_id=scheme_nos.id,
        applicant_name="Rohan Meena",
        applicant_email="rohan.meena@scholar.in",
        applicant_phone="+91-9811223344",
        applicant_data={
            "age": 42,
            "qualifying_exam_percent": 54.0,  # Below minimum 60%
            "admission_confirmed": False,
        },
        current_state="submitted",
    )
    db.add(app2)
    db.commit()
    db.refresh(app2)

    notification_service.notify(NotificationEvent.APPLICATION_SUBMITTED, app2, {"scheme_code": "NOS"})

    print("\n[Step 2.1] Automated Eligibility Check (Expect Failure):")
    app2 = wf_engine.apply_transition(app2, "start_automated_check", actor_user_id=None)
    app2, el_res2 = wf_engine.run_eligibility_check(app2)
    print(f"Eligibility Result: Passed={el_res2.passed} | State: {app2.current_state}")

    # =========================================================================
    # APPLICATION 3: Deficient Documents Path (NFST Scheme)
    # =========================================================================
    print("\n" + "=" * 80)
    print(">> CASE 3: Deficient Documents Application (Pooja Tirkey - NFST)")
    print("=" * 80)
    app3 = Application(
        scheme_id=scheme_nfst.id,
        applicant_name="Pooja Tirkey",
        applicant_email="pooja.tirkey@scholar.in",
        applicant_phone="+91-9844556677",
        applicant_data={
            "age": 27,
            "annual_income": 350000,
            "category": "ST",
        },
        current_state="submitted",
    )
    db.add(app3)
    db.commit()
    db.refresh(app3)

    notification_service.notify(NotificationEvent.APPLICATION_SUBMITTED, app3, {"scheme_code": "NFST"})

    print("\n[Step 3.1] NFST Eligibility Check:")
    app3 = wf_engine.apply_transition(app3, "auto_evaluate", actor_user_id=None)
    app3, el_res3 = wf_engine.run_eligibility_check(app3)
    print(f"Eligibility Result: Passed={el_res3.passed} | State: {app3.current_state}")

    print("\n[Step 3.2] Document Flagged Deficient:")
    doc_def = Document(
        application_id=app3.id,
        doc_type="income_certificate",
        storage_key="docs/income_def.pdf",
        status=DocumentStatus.DEFICIENT,
        deficiency_reasons=["Income certificate is expired (issued > 1 year ago)"],
    )
    db.add(doc_def)
    db.commit()

    app3 = wf_engine.apply_transition(app3, "documents_flagged_deficient", actor_user_id=officer.id)
    print(f"Document Scrutiny: Flagged Deficient | State: {app3.current_state}")

    # =========================================================================
    # AGGREGATE OVERVIEW STATS
    # =========================================================================
    print("\n" + "=" * 80)
    print(">> COMPUTED OVERVIEW STATS JSON (/api/stats/overview)")
    print("=" * 80)
    stats = _compute_stats(db=db, scheme_id=None)
    stats_formatted = {
        "total_applications": stats["total_applications"],
        "applications_by_state": stats["applications_by_state"],
        "applications_by_scheme": stats["applications_by_scheme"],
        "deficient_count": stats["deficient_count"],
        "documents_by_status": stats["documents_by_status"],
        "pending_disbursements_count": stats["pending_disbursements_count"],
        "total_disbursed_amount": stats["total_disbursed_amount"],
        "pending_renewals_count": stats["pending_renewals_count"],
        "recent_activity": [
            {
                "id": str(a.id),
                "action": a.action,
                "application_id": str(a.application_id) if a.application_id else None,
                "created_at": a.created_at.isoformat() if a.created_at else None,
            }
            for a in stats["recent_activity"]
        ],
    }
    print(json.dumps(stats_formatted, indent=2))


if __name__ == "__main__":
    run_demo()
