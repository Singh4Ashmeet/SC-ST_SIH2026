"""
Comprehensive idempotent demo seed script for Scholarship Admin Platform.
Matches the Section 8 Demo Checklist:
  - Scenario 1 (Golden path, NFST): submitted -> eligibility_check -> scrutiny -> selection -> approved -> disbursed -> renewal
  - Scenario 2 (Golden path, NOS): overseas scholarship end-to-end (same engine, different config)
  - Scenario 3 (Unhappy path, NFST): 'deficient' state with stacked reasons (MISSING_FIELD, FORMAT_INVALID, EXPIRED_DATE)
  - Scenario 4 (Ineligible, NOS): fails multiple eligibility criteria simultaneously
  - Extra populated records in scrutiny queue, selection queue, and intake

Usage:
  cd backend
  python -m scripts.seed_demo
"""

from datetime import date, datetime, timezone
import json
from pathlib import Path
import sys
import uuid

# Add backend directory to sys.path
sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

if hasattr(sys.stdout, "reconfigure"):
    sys.stdout.reconfigure(encoding="utf-8", errors="replace")
if hasattr(sys.stderr, "reconfigure"):
    sys.stderr.reconfigure(encoding="utf-8", errors="replace")

from sqlalchemy import delete, select
from app.core.database import Base, SessionLocal, engine
from app.core.security import hash_password
from app.models.application import Application
from app.models.audit_log import AuditLog
from app.models.disbursement import Disbursement, DisbursementStatus
from app.models.document import Document, DocumentStatus
from app.models.renewal import Renewal, RenewalStatus
from app.models.scheme import Scheme
from app.models.user import User, UserRole
from app.services.scheme_config_validator import validate_scheme_config


def seed_demo_data():
    Base.metadata.create_all(bind=engine)
    db = SessionLocal()

    try:
        print("\n" + "=" * 80)
        print("  SCHOLARSHIP ADMIN PLATFORM — DEMO DATA SEED (IDEMPOTENT)")
        print("=" * 80)

        # ---------------------------------------------------------------------
        # 1. CLEANUP PREVIOUS DEMO DATA (Safe & Idempotent)
        # ---------------------------------------------------------------------
        print("\n[1/6] Cleaning up any previous demo application records...")

        # Find existing demo applications by email pattern or legacy test emails
        demo_emails_to_clean = [
            "%@demo.scholarship.gov.in",
            "rajesh.meena@example.com",
            "sunita.bhil@example.com",
            "priya.paswan@example.com",
            "amit.rathore@example.com",
            "ananya.bharti@scholar.in",
            "rohan.meena@scholar.in",
            "pooja.tirkey@scholar.in",
        ]

        deleted_apps_count = 0
        for email_pat in demo_emails_to_clean:
            if "%" in email_pat:
                apps = db.execute(
                    select(Application).where(Application.applicant_email.like(email_pat))
                ).scalars().all()
            else:
                apps = db.execute(
                    select(Application).where(Application.applicant_email == email_pat)
                ).scalars().all()

            for app in apps:
                db.delete(app)
                deleted_apps_count += 1

        db.commit()
        print(f"  Cleaned {deleted_apps_count} old demo applications (and cascades).")

        # ---------------------------------------------------------------------
        # 2. CORE USERS & ROLES
        # ---------------------------------------------------------------------
        print("\n[2/6] Provisioning 4 standard demo users across all lifecycle roles...")

        users_config = [
            {
                "email": "admin@scst.gov.in",
                "password": "admin123",
                "name": "Shri Rajeshwar Verma",
                "role": UserRole.SUPER_ADMIN,
                "title": "Super Administrator / MoSJE Oversight",
            },
            {
                "email": "scheme.admin@scst.gov.in",
                "password": "scheme123",
                "name": "Smt. Sunita Sharma",
                "role": UserRole.SCHEME_ADMIN,
                "title": "Scheme Director & Policy Admin",
            },
            {
                "email": "scrutiny@scst.gov.in",
                "password": "scrutiny123",
                "name": "Dr. Alok Nath",
                "role": UserRole.SCRUTINY_OFFICER,
                "title": "Senior Verification & Scrutiny Officer",
            },
            {
                "email": "selection@scst.gov.in",
                "password": "selection123",
                "name": "Prof. H. R. Soren",
                "role": UserRole.SELECTION_COMMITTEE,
                "title": "Chairman, National Selection Committee",
            },
        ]

        user_map = {}
        for ucfg in users_config:
            existing_user = db.execute(
                select(User).where(User.email == ucfg["email"])
            ).scalar_one_or_none()

            if existing_user:
                existing_user.full_name = ucfg["name"]
                existing_user.role = ucfg["role"]
                existing_user.hashed_password = hash_password(ucfg["password"])
                existing_user.is_active = True
                user_map[ucfg["role"]] = existing_user
                print(f"  Refreshed credentials for {ucfg['role'].value}: {ucfg['email']}")
            else:
                new_user = User(
                    email=ucfg["email"],
                    hashed_password=hash_password(ucfg["password"]),
                    full_name=ucfg["name"],
                    role=ucfg["role"],
                    is_active=True,
                )
                db.add(new_user)
                db.flush()
                user_map[ucfg["role"]] = new_user
                print(f"  Created {ucfg['role'].value}: {ucfg['email']}")

        db.commit()

        # Also ensure legacy committee@scst.gov.in has working credentials if referenced
        legacy_committee = db.execute(
            select(User).where(User.email == "committee@scst.gov.in")
        ).scalar_one_or_none()
        if legacy_committee:
            legacy_committee.hashed_password = hash_password("selection123")
            db.commit()

        admin_user = user_map[UserRole.SUPER_ADMIN]
        scrutiny_user = user_map[UserRole.SCRUTINY_OFFICER]
        selection_user = user_map[UserRole.SELECTION_COMMITTEE]
        scheme_admin_user = user_map[UserRole.SCHEME_ADMIN]

        # ---------------------------------------------------------------------
        # 3. SCHEMES (NFST & NOS)
        # ---------------------------------------------------------------------
        print("\n[3/6] Syncing Scheme Definitions from Fixture Configs...")
        fixtures_dir = Path(__file__).resolve().parent.parent / "app" / "fixtures"

        with open(fixtures_dir / "nfst_config.json", "r", encoding="utf-8") as f:
            nfst_raw = json.load(f)
        nfst_validated = validate_scheme_config(nfst_raw)

        with open(fixtures_dir / "nos_config.json", "r", encoding="utf-8") as f:
            nos_raw = json.load(f)
        nos_validated = validate_scheme_config(nos_raw)

        # NFST
        nfst_scheme = db.execute(
            select(Scheme).where(Scheme.code == "NFST")
        ).scalar_one_or_none()

        if not nfst_scheme:
            nfst_scheme = Scheme(
                code="NFST",
                name="National Fellowship for Higher Education of ST Students",
                description="Fellowship for M.Phil and Ph.D. Scheduled Tribe scholars.",
                config=nfst_validated.model_dump(),
                is_active=True,
                created_by=admin_user.id,
            )
            db.add(nfst_scheme)
            db.flush()
            db.add(
                AuditLog(
                    scheme_id=nfst_scheme.id,
                    actor_user_id=admin_user.id,
                    action="scheme_created",
                    details={"config_version": 1},
                )
            )
            print("  Created Scheme: NFST (National Fellowship for ST Students)")
        else:
            nfst_scheme.config = nfst_validated.model_dump()
            nfst_scheme.is_active = True
            print("  Updated Scheme: NFST (Active, Config synced)")

        # NOS
        nos_scheme = db.execute(
            select(Scheme).where(Scheme.code == "NOS")
        ).scalar_one_or_none()

        if not nos_scheme:
            nos_scheme = Scheme(
                code="NOS",
                name="National Overseas Scholarship for SC/ST Candidates",
                description="Scholarship for SC/ST students studying abroad at Master's/Ph.D. level.",
                config=nos_validated.model_dump(),
                is_active=True,
                created_by=admin_user.id,
            )
            db.add(nos_scheme)
            db.flush()
            db.add(
                AuditLog(
                    scheme_id=nos_scheme.id,
                    actor_user_id=admin_user.id,
                    action="scheme_created",
                    details={"config_version": 1},
                )
            )
            print("  Created Scheme: NOS (National Overseas Scholarship)")
        else:
            nos_scheme.config = nos_validated.model_dump()
            nos_scheme.is_active = True
            print("  Updated Scheme: NOS (Active, Config synced)")

        db.commit()

        # ---------------------------------------------------------------------
        # 4. SCENARIOS POPULATION
        # ---------------------------------------------------------------------
        print("\n[4/6] Creating Structured Lifecycle Demonstration Scenarios...")
        demo_summary_records = []

        # =====================================================================
        # SCENARIO 1: Golden Path NFST (End-to-End Advanced)
        # =====================================================================
        app1 = Application(
            scheme_id=nfst_scheme.id,
            applicant_name="Bikram Kishore Hansda",
            applicant_email="bikram.hansda@demo.scholarship.gov.in",
            applicant_phone="+91-9876500001",
            applicant_data={
                "age": 27,
                "annual_income": 380000,
                "category": "ST",
                "qualification": "Ph.D",
                "university": "Jawaharlal Nehru University",
                "department": "Centre for Linguistics",
                "research_area": "Mundari & Austroasiatic Phonology",
                "is_demo": True,
            },
            current_state="approved",
        )
        db.add(app1)
        db.flush()

        # Complete Audit Trail
        for action, from_s, to_s, actor_id, details in [
            ("application_created", None, "submitted", None, {"submission_channel": "web_portal"}),
            ("transition", "submitted", "eligibility_check", None, {"trigger": "auto_evaluate"}),
            (
                "eligibility_check_passed",
                "eligibility_check",
                "document_scrutiny",
                None,
                {
                    "trigger": "eligibility_passed",
                    "checks": ["age <= 36 (27)", "annual_income <= 600000 (380000)", "category == 'ST' ('ST')"],
                },
            ),
            (
                "documents_verified",
                "document_scrutiny",
                "selection",
                scrutiny_user.id,
                {"verified_documents_count": 4, "officer_notes": "All original certificates matched state records."},
            ),
            (
                "committee_approved",
                "selection",
                "approved",
                selection_user.id,
                {
                    "committee_score": 94.5,
                    "resolution": "Unanimously selected for 5-year doctoral fellowship.",
                },
            ),
        ]:
            db.add(
                AuditLog(
                    application_id=app1.id,
                    scheme_id=nfst_scheme.id,
                    actor_user_id=actor_id,
                    action=action,
                    from_state=from_s,
                    to_state=to_s,
                    details=details,
                )
            )

        # 4 Verified Documents with OCR Extracted Fields
        doc1_1 = Document(
            application_id=app1.id,
            doc_type="caste_certificate",
            storage_key=f"{app1.id}/caste_certificate/bikram_st_cert.pdf",
            status=DocumentStatus.VERIFIED,
            content_type="application/pdf",
            extracted_fields={
                "certificate_no": "ST/OD/2024/9912",
                "issuing_authority": "Sub-Collector, Mayurbhanj",
                "category": "ST",
                "issue_date": "2024-03-12",
            },
            reviewed_at=datetime(2026, 8, 10, 11, 30, tzinfo=timezone.utc),
        )
        doc1_2 = Document(
            application_id=app1.id,
            doc_type="income_certificate",
            storage_key=f"{app1.id}/income_certificate/bikram_income.pdf",
            status=DocumentStatus.VERIFIED,
            content_type="application/pdf",
            extracted_fields={
                "annual_income": "380000",
                "issuing_authority": "Tahasildar, Baripada",
                "issue_date": "2025-06-10",
            },
            reviewed_at=datetime(2026, 8, 10, 11, 32, tzinfo=timezone.utc),
        )
        doc1_3 = Document(
            application_id=app1.id,
            doc_type="marksheet",
            storage_key=f"{app1.id}/marksheet/bikram_pg_marksheet.pdf",
            status=DocumentStatus.VERIFIED,
            content_type="application/pdf",
            extracted_fields={
                "percentage": "79.2",
                "degree": "M.Phil Linguistics",
                "university": "JNU Delhi",
                "year": "2024",
            },
            reviewed_at=datetime(2026, 8, 10, 11, 35, tzinfo=timezone.utc),
        )
        doc1_4 = Document(
            application_id=app1.id,
            doc_type="bonafide_certificate",
            storage_key=f"{app1.id}/bonafide_certificate/bikram_bonafide.pdf",
            status=DocumentStatus.VERIFIED,
            content_type="application/pdf",
            extracted_fields={
                "university": "Jawaharlal Nehru University",
                "enrollment_no": "JNU/CSS/PHD/2025/082",
                "admission_date": "2025-08-01",
            },
            reviewed_at=datetime(2026, 8, 10, 11, 37, tzinfo=timezone.utc),
        )
        db.add_all([doc1_1, doc1_2, doc1_3, doc1_4])

        # 1 Completed Disbursement + 1 Pending Disbursement
        disb1_1 = Disbursement(
            application_id=app1.id,
            amount=180000.0,
            status=DisbursementStatus.DISBURSED,
            disbursed_date=date(2026, 8, 15),
            installment_number=1,
            remarks="Tranche 1 (Stipend INR 1,50,000 + Contingency INR 30,000) remitted via PFMS/DBT",
            created_by=admin_user.id,
        )
        disb1_2 = Disbursement(
            application_id=app1.id,
            amount=180000.0,
            status=DisbursementStatus.PENDING,
            installment_number=2,
            remarks="Tranche 2 (Academic Year 2026-27 - Q3 & Q4 stipend) queued for release",
            created_by=admin_user.id,
        )
        db.add_all([disb1_1, disb1_2])

        # 1 Approved Renewal + 1 Pending Renewal Cycle
        ren1_1 = Renewal(
            application_id=app1.id,
            academic_year_or_cycle="2026-27",
            status=RenewalStatus.APPROVED,
            due_date=date(2026, 8, 1),
            reviewed_date=date(2026, 8, 10),
            reviewer_id=selection_user.id,
            remarks="Initial doctoral admission and supervisor allocation verified. Approved for Year 1.",
        )
        ren1_2 = Renewal(
            application_id=app1.id,
            academic_year_or_cycle="2027-28",
            status=RenewalStatus.PENDING_REVIEW,
            due_date=date(2027, 3, 31),
            remarks="Year 2 continuation review: awaiting annual progress committee report.",
        )
        db.add_all([ren1_1, ren1_2])

        demo_summary_records.append({
            "scenario": "Scenario 1 (Golden Path NFST)",
            "scheme": "NFST",
            "applicant": app1.applicant_name,
            "id": str(app1.id),
            "state": app1.current_state,
            "description": "Full lifecycle completed: automated eligibility -> verified docs -> committee approval -> disbursed tranche -> active renewal.",
        })
        print("  [OK] Scenario 1: NFST Golden Path (Bikram Kishore Hansda)")

        # =====================================================================
        # SCENARIO 2: Golden Path NOS (End-to-End Advanced)
        # =====================================================================
        app2 = Application(
            scheme_id=nos_scheme.id,
            applicant_name="Arjun Prakash Sonkar",
            applicant_email="arjun.sonkar@demo.scholarship.gov.in",
            applicant_phone="+91-9876500002",
            applicant_data={
                "age": 28,
                "qualifying_exam_percent": 84.5,
                "admission_confirmed": True,
                "university_abroad": "Imperial College London",
                "course": "MSc in Artificial Intelligence",
                "country": "United Kingdom",
                "is_demo": True,
            },
            current_state="approved",
        )
        db.add(app2)
        db.flush()

        for action, from_s, to_s, actor_id, details in [
            ("application_created", None, "submitted", None, {"submission_channel": "web_portal"}),
            ("transition", "submitted", "eligibility_check", None, {"trigger": "start_automated_check"}),
            (
                "eligibility_check_passed",
                "eligibility_check",
                "document_scrutiny",
                None,
                {
                    "trigger": "eligibility_passed",
                    "checks": [
                        "qualifying_exam_percent >= 60 (84.5)",
                        "admission_confirmed == true (True)",
                        "age <= 35 (28)",
                    ],
                },
            ),
            (
                "documents_verified",
                "document_scrutiny",
                "selection",
                scrutiny_user.id,
                {"verified_documents_count": 3, "officer_notes": "Passport and unconditional admission validated with university admissions portal."},
            ),
            (
                "committee_approved",
                "selection",
                "approved",
                selection_user.id,
                {"committee_score": 96.0, "resolution": "Awarded full overseas scholarship under Engineering & Tech quota."},
            ),
        ]:
            db.add(
                AuditLog(
                    application_id=app2.id,
                    scheme_id=nos_scheme.id,
                    actor_user_id=actor_id,
                    action=action,
                    from_state=from_s,
                    to_state=to_s,
                    details=details,
                )
            )

        doc2_1 = Document(
            application_id=app2.id,
            doc_type="passport",
            storage_key=f"{app2.id}/passport/arjun_passport.pdf",
            status=DocumentStatus.VERIFIED,
            content_type="application/pdf",
            extracted_fields={
                "passport_number": "Z8921345",
                "name": "ARJUN PRAKASH SONKAR",
                "expiry_date": "2032-11-20",
                "issuing_country": "IND",
            },
            reviewed_at=datetime(2026, 8, 20, 14, 10, tzinfo=timezone.utc),
        )
        doc2_2 = Document(
            application_id=app2.id,
            doc_type="admission_letter",
            storage_key=f"{app2.id}/admission_letter/imperial_offer.pdf",
            status=DocumentStatus.VERIFIED,
            content_type="application/pdf",
            extracted_fields={
                "university": "Imperial College London",
                "course": "MSc Artificial Intelligence",
                "admission_status": "Unconditional",
                "admission_date": "2026-09-28",
            },
            reviewed_at=datetime(2026, 8, 20, 14, 12, tzinfo=timezone.utc),
        )
        doc2_3 = Document(
            application_id=app2.id,
            doc_type="degree_transcript",
            storage_key=f"{app2.id}/degree_transcript/iit_transcript.pdf",
            status=DocumentStatus.VERIFIED,
            content_type="application/pdf",
            extracted_fields={
                "percentage": "84.5",
                "degree": "B.Tech Computer Science & Engineering",
                "university": "IIT Roorkee",
                "graduation_year": "2023",
            },
            reviewed_at=datetime(2026, 8, 20, 14, 15, tzinfo=timezone.utc),
        )
        db.add_all([doc2_1, doc2_2, doc2_3])

        disb2 = Disbursement(
            application_id=app2.id,
            amount=1500000.0,
            status=DisbursementStatus.DISBURSED,
            disbursed_date=date(2026, 9, 5),
            installment_number=1,
            remarks="Tuition fees installment 1 remitted directly to Imperial College London international wire account",
            created_by=admin_user.id,
        )
        db.add(disb2)

        ren2 = Renewal(
            application_id=app2.id,
            academic_year_or_cycle="2026-27",
            status=RenewalStatus.APPROVED,
            due_date=date(2027, 4, 30),
            reviewed_date=date(2026, 9, 10),
            reviewer_id=selection_user.id,
            remarks="Overseas academic mentor verification certificate validated. Approved.",
        )
        db.add(ren2)

        demo_summary_records.append({
            "scenario": "Scenario 2 (Golden Path NOS)",
            "scheme": "NOS",
            "applicant": app2.applicant_name,
            "id": str(app2.id),
            "state": app2.current_state,
            "description": "Proves scheme configurability: identical engine handles different workflow rules, criteria, and international documents.",
        })
        print("  [OK] Scenario 2: NOS Golden Path (Arjun Prakash Sonkar)")

        # =====================================================================
        # SCENARIO 3: Unhappy Path NFST (Deficient State + Stacked Reasons)
        # =====================================================================
        app3 = Application(
            scheme_id=nfst_scheme.id,
            applicant_name="Pooja Rameshwar Tirkey",
            applicant_email="pooja.tirkey@demo.scholarship.gov.in",
            applicant_phone="+91-9876500003",
            applicant_data={
                "age": 25,
                "annual_income": 320000,
                "category": "ST",
                "qualification": "Ph.D",
                "university": "Banaras Hindu University",
                "research_area": "Indigenous Botanicals & Medicine",
                "is_demo": True,
            },
            current_state="deficient",
        )
        db.add(app3)
        db.flush()

        for action, from_s, to_s, actor_id, details in [
            ("application_created", None, "submitted", None, {"submission_channel": "web_portal"}),
            ("transition", "submitted", "eligibility_check", None, {"trigger": "auto_evaluate"}),
            ("eligibility_check_passed", "eligibility_check", "document_scrutiny", None, {"trigger": "eligibility_passed"}),
            (
                "documents_flagged_deficient",
                "document_scrutiny",
                "deficient",
                scrutiny_user.id,
                {
                    "trigger": "documents_flagged_deficient",
                    "flagged_documents_count": 2,
                    "reasons": [
                        "income_certificate: EXPIRED_DATE, FORMAT_INVALID, MISSING_FIELD",
                        "caste_certificate: MISSING_FIELD, FORMAT_INVALID",
                    ],
                },
            ),
        ]:
            db.add(
                AuditLog(
                    application_id=app3.id,
                    scheme_id=nfst_scheme.id,
                    actor_user_id=actor_id,
                    action=action,
                    from_state=from_s,
                    to_state=to_s,
                    details=details,
                )
            )

        # Deficient Document 1: Income Certificate (Stacked: EXPIRED_DATE, FORMAT_INVALID, MISSING_FIELD)
        doc3_income = Document(
            application_id=app3.id,
            doc_type="income_certificate",
            storage_key=f"{app3.id}/income_certificate/expired_income.pdf",
            status=DocumentStatus.DEFICIENT,
            content_type="application/pdf",
            extracted_fields={
                "issue_date": "2023-01-15",
                "annual_income": "-50000",
            },
            deficiency_reasons=[
                {
                    "code": "EXPIRED_DATE",
                    "field": "issue_date",
                    "message": "Document expired on 2024-01-15 (issued 2023-01-15, validity 365 days; certificates older than 1 year are invalid).",
                },
                {
                    "code": "FORMAT_INVALID",
                    "field": "annual_income",
                    "message": "annual_income must be a valid positive number, got: -50000",
                },
                {
                    "code": "MISSING_FIELD",
                    "field": "issuing_authority",
                    "message": "Required field 'issuing_authority' is missing or unreadable (official designation/tehsildar seal absent).",
                },
            ],
            reviewed_at=datetime(2026, 9, 2, 10, 15, tzinfo=timezone.utc),
        )

        # Deficient Document 2: Caste Certificate (MISSING_FIELD, FORMAT_INVALID)
        doc3_caste = Document(
            application_id=app3.id,
            doc_type="caste_certificate",
            storage_key=f"{app3.id}/caste_certificate/blurry_caste.pdf",
            status=DocumentStatus.DEFICIENT,
            content_type="application/pdf",
            extracted_fields={"certificate_no": "ST/TEMP/0091"},
            deficiency_reasons=[
                {
                    "code": "MISSING_FIELD",
                    "field": "category",
                    "message": "Required field 'category' is missing or not identified as ST.",
                },
                {
                    "code": "FORMAT_INVALID",
                    "field": "issue_date",
                    "message": "issue_date must be a valid date (DD/MM/YYYY), got: UNREADABLE_BLUR",
                },
            ],
            reviewed_at=datetime(2026, 9, 2, 10, 18, tzinfo=timezone.utc),
        )

        # Verified Marksheet & Bonafide
        doc3_marksheet = Document(
            application_id=app3.id,
            doc_type="marksheet",
            storage_key=f"{app3.id}/marksheet/pooja_marksheet.pdf",
            status=DocumentStatus.VERIFIED,
            content_type="application/pdf",
            extracted_fields={"percentage": "78.4", "degree": "M.Sc Botany", "university": "BHU Varanasi", "year": "2024"},
            reviewed_at=datetime(2026, 9, 2, 10, 20, tzinfo=timezone.utc),
        )
        doc3_bonafide = Document(
            application_id=app3.id,
            doc_type="bonafide_certificate",
            storage_key=f"{app3.id}/bonafide_certificate/pooja_bonafide.pdf",
            status=DocumentStatus.VERIFIED,
            content_type="application/pdf",
            extracted_fields={"university": "Banaras Hindu University", "enrollment_no": "BHU/RES/2024/441", "admission_date": "2024-07-20"},
            reviewed_at=datetime(2026, 9, 2, 10, 21, tzinfo=timezone.utc),
        )
        db.add_all([doc3_income, doc3_caste, doc3_marksheet, doc3_bonafide])

        demo_summary_records.append({
            "scenario": "Scenario 3 (Unhappy Path NFST)",
            "scheme": "NFST",
            "applicant": app3.applicant_name,
            "id": str(app3.id),
            "state": app3.current_state,
            "description": "Crucial live demo: stacked deficiency reasons (EXPIRED_DATE, FORMAT_INVALID, MISSING_FIELD). Ready for live resubmission.",
        })
        print("  [OK] Scenario 3: NFST Deficient Unhappy Path (Pooja Rameshwar Tirkey)")

        # =====================================================================
        # SCENARIO 4: Ineligible Path (Multiple Simultaneous Rule Failures)
        # =====================================================================
        app4 = Application(
            scheme_id=nos_scheme.id,
            applicant_name="Devendra Nath Murmu",
            applicant_email="devendra.murmu@demo.scholarship.gov.in",
            applicant_phone="+91-9876500004",
            applicant_data={
                "age": 42,
                "qualifying_exam_percent": 52.0,
                "admission_confirmed": False,
                "university_abroad": "National University of Singapore",
                "course": "Master of Computing",
                "is_demo": True,
            },
            current_state="rejected",
        )
        db.add(app4)
        db.flush()

        for action, from_s, to_s, actor_id, details in [
            ("application_created", None, "submitted", None, {"submission_channel": "web_portal"}),
            ("transition", "submitted", "eligibility_check", None, {"trigger": "start_automated_check"}),
            (
                "eligibility_check_failed",
                "eligibility_check",
                "rejected",
                None,
                {
                    "trigger": "eligibility_failed",
                    "failed_rules_count": 3,
                    "failed_rules": [
                        {
                            "rule": "qualifying_exam_percent >= 60",
                            "actual": 52.0,
                            "failure_message": "Minimum 60% aggregate marks required in qualifying degree.",
                        },
                        {
                            "rule": "admission_confirmed == true",
                            "actual": False,
                            "failure_message": "Unconditional foreign university admission offer required.",
                        },
                        {
                            "rule": "age <= 35",
                            "actual": 42,
                            "failure_message": "Applicant age must not exceed 35 years.",
                        },
                    ],
                },
            ),
        ]:
            db.add(
                AuditLog(
                    application_id=app4.id,
                    scheme_id=nos_scheme.id,
                    actor_user_id=actor_id,
                    action=action,
                    from_state=from_s,
                    to_state=to_s,
                    details=details,
                )
            )

        demo_summary_records.append({
            "scenario": "Scenario 4 (Ineligible NOS)",
            "scheme": "NOS",
            "applicant": app4.applicant_name,
            "id": str(app4.id),
            "state": app4.current_state,
            "description": "Demonstrates automated eligibility evaluation catching 3 failing rules simultaneously with transparent audit logs.",
        })
        print("  [OK] Scenario 4: NOS Ineligible Path (Devendra Nath Murmu)")

        # =====================================================================
        # EXTRA APPLICATIONS FOR REALISTIC QUEUES AND DASHBOARD STATS
        # =====================================================================
        # Extra 1: In Document Scrutiny Queue (NFST)
        app_extra1 = Application(
            scheme_id=nfst_scheme.id,
            applicant_name="Kavita Ramesh Soren",
            applicant_email="kavita.soren@demo.scholarship.gov.in",
            applicant_phone="+91-9876500005",
            applicant_data={
                "age": 26,
                "annual_income": 410000,
                "category": "ST",
                "qualification": "M.Phil",
                "university": "Ranchi University",
                "is_demo": True,
            },
            current_state="document_scrutiny",
        )
        db.add(app_extra1)
        db.flush()

        db.add(AuditLog(application_id=app_extra1.id, scheme_id=nfst_scheme.id, action="application_created", from_state=None, to_state="submitted"))
        db.add(AuditLog(application_id=app_extra1.id, scheme_id=nfst_scheme.id, action="transition", from_state="submitted", to_state="eligibility_check"))
        db.add(AuditLog(application_id=app_extra1.id, scheme_id=nfst_scheme.id, action="eligibility_check_passed", from_state="eligibility_check", to_state="document_scrutiny"))

        db.add(Document(application_id=app_extra1.id, doc_type="caste_certificate", storage_key=f"{app_extra1.id}/caste/caste.pdf", status=DocumentStatus.VERIFIED, content_type="application/pdf", extracted_fields={"certificate_no": "ST/JH/2024/7711", "category": "ST"}))
        db.add(Document(application_id=app_extra1.id, doc_type="income_certificate", storage_key=f"{app_extra1.id}/income/income.pdf", status=DocumentStatus.PENDING, content_type="application/pdf"))
        db.add(Document(application_id=app_extra1.id, doc_type="marksheet", storage_key=f"{app_extra1.id}/marksheet/marksheet.pdf", status=DocumentStatus.PENDING, content_type="application/pdf"))
        db.add(Document(application_id=app_extra1.id, doc_type="bonafide_certificate", storage_key=f"{app_extra1.id}/bonafide/bonafide.pdf", status=DocumentStatus.VERIFIED, content_type="application/pdf", extracted_fields={"university": "Ranchi University"}))

        demo_summary_records.append({
            "scenario": "Live Queue 1 (Scrutiny Queue)",
            "scheme": "NFST",
            "applicant": app_extra1.applicant_name,
            "id": str(app_extra1.id),
            "state": app_extra1.current_state,
            "description": "Ready in Document Scrutiny Queue with mixed verified & pending documents.",
        })

        # Extra 2: In Selection Committee Queue (NOS)
        app_extra2 = Application(
            scheme_id=nos_scheme.id,
            applicant_name="Tanvi Siddharth Kamble",
            applicant_email="tanvi.kamble@demo.scholarship.gov.in",
            applicant_phone="+91-9876500006",
            applicant_data={
                "age": 29,
                "qualifying_exam_percent": 88.0,
                "admission_confirmed": True,
                "university_abroad": "ETH Zurich",
                "course": "MSc Robotics, Systems and Control",
                "country": "Switzerland",
                "is_demo": True,
            },
            current_state="selection",
        )
        db.add(app_extra2)
        db.flush()

        db.add(AuditLog(application_id=app_extra2.id, scheme_id=nos_scheme.id, action="application_created", from_state=None, to_state="submitted"))
        db.add(AuditLog(application_id=app_extra2.id, scheme_id=nos_scheme.id, action="transition", from_state="submitted", to_state="eligibility_check"))
        db.add(AuditLog(application_id=app_extra2.id, scheme_id=nos_scheme.id, action="eligibility_check_passed", from_state="eligibility_check", to_state="document_scrutiny"))
        db.add(AuditLog(application_id=app_extra2.id, scheme_id=nos_scheme.id, action="documents_verified", from_state="document_scrutiny", to_state="selection", actor_user_id=scrutiny_user.id))

        db.add(Document(application_id=app_extra2.id, doc_type="passport", storage_key=f"{app_extra2.id}/passport/tanvi_passport.pdf", status=DocumentStatus.VERIFIED, content_type="application/pdf", extracted_fields={"passport_number": "M6678129", "name": "TANVI SIDDHARTH KAMBLE", "expiry_date": "2034-04-18"}))
        db.add(Document(application_id=app_extra2.id, doc_type="admission_letter", storage_key=f"{app_extra2.id}/admission/eth_zurich.pdf", status=DocumentStatus.VERIFIED, content_type="application/pdf", extracted_fields={"university": "ETH Zurich", "course": "MSc Robotics", "admission_status": "Unconditional"}))
        db.add(Document(application_id=app_extra2.id, doc_type="degree_transcript", storage_key=f"{app_extra2.id}/transcript/btech_iitb.pdf", status=DocumentStatus.VERIFIED, content_type="application/pdf", extracted_fields={"percentage": "88.0", "degree": "B.Tech Electrical", "university": "IIT Bombay"}))

        demo_summary_records.append({
            "scenario": "Live Queue 2 (Selection Queue)",
            "scheme": "NOS",
            "applicant": app_extra2.applicant_name,
            "id": str(app_extra2.id),
            "state": app_extra2.current_state,
            "description": "Ready in Selection Committee Queue: all docs verified, awaiting 1-click Approve/Reject decision.",
        })

        # Extra 3: Fresh Intake Submitted (NFST)
        app_extra3 = Application(
            scheme_id=nfst_scheme.id,
            applicant_name="Manish Kumar Gond",
            applicant_email="manish.gond@demo.scholarship.gov.in",
            applicant_phone="+91-9876500007",
            applicant_data={
                "age": 24,
                "annual_income": 280000,
                "category": "ST",
                "qualification": "M.Sc",
                "university": "Gauhati University",
                "is_demo": True,
            },
            current_state="submitted",
        )
        db.add(app_extra3)
        db.flush()
        db.add(AuditLog(application_id=app_extra3.id, scheme_id=nfst_scheme.id, action="application_created", from_state=None, to_state="submitted"))

        demo_summary_records.append({
            "scenario": "Live Queue 3 (Fresh Submission)",
            "scheme": "NFST",
            "applicant": app_extra3.applicant_name,
            "id": str(app_extra3.id),
            "state": app_extra3.current_state,
            "description": "Fresh application intake awaiting automated evaluation.",
        })

        db.commit()

        # ---------------------------------------------------------------------
        # 5. GENERATE SAMPLE CLEAN DOCUMENT FOR LIVE RESUBMISSION DEMO
        # ---------------------------------------------------------------------
        print("\n[5/6] Generating sample clean document for live resubmission demonstration...")
        try:
            from reportlab.lib.pagesizes import letter
            from reportlab.pdfgen import canvas

            sample_pdf_path = Path(__file__).resolve().parent.parent.parent / "sample_clean_income_certificate.pdf"
            c = canvas.Canvas(str(sample_pdf_path), pagesize=letter)
            c.setFont("Helvetica-Bold", 16)
            c.drawString(100, 720, "GOVERNMENT OF UTTAR PRADESH")
            c.setFont("Helvetica-Bold", 12)
            c.drawString(100, 700, "REVENUE DEPARTMENT — OFFICE OF THE TEHSILDAR")
            c.setFont("Helvetica", 11)
            c.drawString(100, 670, "CERTIFICATE OF ANNUAL FAMILY INCOME")
            c.line(100, 660, 500, 660)

            c.drawString(100, 630, "Certificate Number: INC/2026/90218")
            c.drawString(100, 600, "Name: Pooja Rameshwar Tirkey")
            c.drawString(100, 570, "Father's Name: Rameshwar Tirkey")
            c.drawString(100, 540, "Address: Village & Post Sakaldiha, District Chandauli, UP")
            c.drawString(100, 510, "Annual Family Income: INR 320000")
            c.drawString(100, 480, "Issuing Authority: Tehsildar, Chandauli")
            c.drawString(100, 450, "Issue Date: 15/06/2026")
            c.drawString(100, 420, "Validity Period: 1 Year (Valid up to 14/06/2027)")

            c.line(100, 390, 500, 390)
            c.setFont("Helvetica-Oblique", 9)
            c.drawString(100, 370, "Digitally signed by Shri V. K. Singh, Tehsildar, Revenue Council.")
            c.save()
            print(f"  Generated clean PDF at: {sample_pdf_path.name}")
        except Exception as ex:
            print(f"  Note: Reportlab generation skipped ({ex}).")

        # Save demo_context.json for automated tests and quick reference
        demo_context_path = Path(__file__).resolve().parent.parent.parent / "demo_context.json"
        demo_context_data = {
            "credentials": {ucfg["role"].value: {"email": ucfg["email"], "password": ucfg["password"], "name": ucfg["name"]} for ucfg in users_config},
            "scenarios": {rec["scenario"].split()[0].lower() if "Scenario" in rec["scenario"] else rec["scenario"]: rec for rec in demo_summary_records},
            "applications": demo_summary_records,
            "urls": {
                "dashboard_overview": "http://localhost:3000/dashboard",
                "schemes_list": "http://localhost:3000/dashboard/schemes",
                "scrutiny_queue": "http://localhost:3000/dashboard/scrutiny",
                "selection_queue": "http://localhost:3000/dashboard/selection",
                "scenario_1_detail": f"http://localhost:3000/dashboard/applications/{app1.id}",
                "scenario_1_post_selection": f"http://localhost:3000/dashboard/applications/{app1.id}/post-selection",
                "scenario_2_detail": f"http://localhost:3000/dashboard/applications/{app2.id}",
                "scenario_3_scrutiny": f"http://localhost:3000/dashboard/scrutiny/{app3.id}",
                "scenario_3_applicant_status": f"http://localhost:3000/apply/status/{app3.id}",
                "scenario_4_detail": f"http://localhost:3000/dashboard/applications/{app4.id}",
                "selection_action": f"http://localhost:3000/dashboard/selection/{app_extra2.id}",
            }
        }
        with open(demo_context_path, "w", encoding="utf-8") as f:
            json.dump(demo_context_data, f, indent=2)
        print(f"  Saved demo context JSON to: {demo_context_path.name}")

        # ---------------------------------------------------------------------
        # 6. PRINT COMPREHENSIVE ON-SCREEN CHEAT SHEET
        # ---------------------------------------------------------------------
        print("\n" + "=" * 80)
        print("  DEMO DATA SEED COMPLETE — PRESENTATION CHEAT SHEET")
        print("=" * 80)

        print("\n--- 🔑 USER CREDENTIALS (MEMORABLE) ---")
        print(f"{'Role':<22} | {'Email':<28} | {'Password':<12} | {'Person / Purpose'}")
        print("-" * 88)
        for ucfg in users_config:
            print(f"{ucfg['role'].value:<22} | {ucfg['email']:<28} | {ucfg['password']:<12} | {ucfg['name']} ({ucfg['title']})")

        print("\n--- 📋 SCENARIOS & APPLICATION IDS ---")
        print(f"{'Scenario':<30} | {'Scheme':<6} | {'Current State':<18} | {'Application ID'}")
        print("-" * 92)
        for rec in demo_summary_records:
            print(f"{rec['scenario']:<30} | {rec['scheme']:<6} | {rec['state']:<18} | {rec['id']}")

        print("\n--- 🌐 DIRECT DEMO SCREEN SHORTCUTS ---")
        print(f"  • Dashboard Overview:          http://localhost:3000/dashboard")
        print(f"  • Scheme Configs:              http://localhost:3000/dashboard/schemes")
        print(f"  • Scenario 1 (NFST Detail):    http://localhost:3000/dashboard/applications/{app1.id}")
        print(f"  • Scenario 1 (Post-Selection): http://localhost:3000/dashboard/applications/{app1.id}/post-selection")
        print(f"  • Scenario 2 (NOS Detail):     http://localhost:3000/dashboard/applications/{app2.id}")
        print(f"  • Scenario 3 (Scrutiny View):  http://localhost:3000/dashboard/scrutiny/{app3.id}")
        print(f"  • Scenario 3 (Applicant Portal): http://localhost:3000/apply/status/{app3.id}")
        print(f"  • Scenario 4 (Ineligible):     http://localhost:3000/dashboard/applications/{app4.id}")
        print(f"  • Selection Queue (Live):      http://localhost:3000/dashboard/selection/{app_extra2.id}")

        print("\n--- 🎯 QUICK NARRATIVE HIGHLIGHTS ---")
        for rec in demo_summary_records:
            print(f"  • {rec['applicant']} ({rec['scheme']}, ID: {rec['id']})")
            print(f"    State: {rec['state']} | {rec['description']}\n")

        print("=" * 80)
        print("Ready for live rehearsal! Follow DEMO_SCRIPT.md step-by-step.")
        print("=" * 80 + "\n")

    except Exception as e:
        db.rollback()
        print(f"\n❌ Seed failed: {e}")
        raise
    finally:
        db.close()


if __name__ == "__main__":
    seed_demo_data()
