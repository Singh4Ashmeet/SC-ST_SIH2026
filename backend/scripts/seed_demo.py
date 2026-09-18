"""
Seed script for demo data.

Creates:
  - SUPER_ADMIN user (admin@scst.gov.in / admin123)
  - SCRUTINY_OFFICER user (scrutiny@scst.gov.in / officer123)
  - Both NFST and NOS schemes from fixture JSON files
  - Test applications in various workflow states
  - Test documents with mixed statuses
  - Audit log entries

Usage:
  cd backend
  python -m scripts.seed_demo
"""

import json
import sys
import uuid
from pathlib import Path
from datetime import datetime, timezone

# Add parent directory to path so we can import app modules
sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

if hasattr(sys.stdout, "reconfigure"):
    sys.stdout.reconfigure(encoding="utf-8", errors="replace")
if hasattr(sys.stderr, "reconfigure"):
    sys.stderr.reconfigure(encoding="utf-8", errors="replace")

from sqlalchemy import select
from app.core.database import Base, engine, SessionLocal
from app.core.security import hash_password
from app.models.user import User, UserRole
from app.models.scheme import Scheme
from app.models.application import Application
from app.models.document import Document, DocumentStatus
from app.models.audit_log import AuditLog
from app.services.scheme_config_validator import validate_scheme_config


def seed():
    Base.metadata.create_all(bind=engine)
    db = SessionLocal()
    try:
        print("🌱 Starting demo data seed...")

        # ── 1. Users ──────────────────────────────────────────────────
        admin = db.execute(
            select(User).where(User.email == "admin@scst.gov.in")
        ).scalar_one_or_none()

        if not admin:
            admin = User(
                email="admin@scst.gov.in",
                hashed_password=hash_password("admin123"),
                full_name="Super Administrator",
                role=UserRole.SUPER_ADMIN,
                is_active=True,
            )
            db.add(admin)
            db.flush()
            print("  ✅ Created SUPER_ADMIN: admin@scst.gov.in / admin123")
        else:
            print("  ⏭️  SUPER_ADMIN already exists")

        scrutiny = db.execute(
            select(User).where(User.email == "scrutiny@scst.gov.in")
        ).scalar_one_or_none()

        if not scrutiny:
            scrutiny = User(
                email="scrutiny@scst.gov.in",
                hashed_password=hash_password("officer123"),
                full_name="Scrutiny Officer",
                role=UserRole.SCRUTINY_OFFICER,
                is_active=True,
            )
            db.add(scrutiny)
            db.flush()
            print("  ✅ Created SCRUTINY_OFFICER: scrutiny@scst.gov.in / officer123")
        else:
            print("  ⏭️  SCRUTINY_OFFICER already exists")

        # ── 2. Schemes ───────────────────────────────────────────────
        fixtures_dir = Path(__file__).resolve().parent.parent / "app" / "fixtures"

        nfst_scheme = db.execute(
            select(Scheme).where(Scheme.code == "NFST")
        ).scalar_one_or_none()

        if not nfst_scheme:
            nfst_config = json.loads((fixtures_dir / "nfst_config.json").read_text())
            validated = validate_scheme_config(nfst_config)
            nfst_scheme = Scheme(
                code="NFST",
                name="National Fellowship for Scheduled Tribes",
                description="Fellowship for ST candidates pursuing M.Phil/Ph.D research.",
                config=validated.model_dump(),
                is_active=True,
                created_by=admin.id,
            )
            db.add(nfst_scheme)
            db.flush()
            db.add(AuditLog(
                scheme_id=nfst_scheme.id, actor_user_id=admin.id,
                action="scheme_created", details={"config_version": 1},
            ))
            print("  ✅ Created NFST scheme")
        else:
            print("  ⏭️  NFST scheme already exists")

        nos_scheme = db.execute(
            select(Scheme).where(Scheme.code == "NOS")
        ).scalar_one_or_none()

        if not nos_scheme:
            nos_config = json.loads((fixtures_dir / "nos_config.json").read_text())
            validated = validate_scheme_config(nos_config)
            nos_scheme = Scheme(
                code="NOS",
                name="National Overseas Scholarship",
                description="Scholarship for SC/ST/DNT candidates studying abroad at Masters/PhD level.",
                config=validated.model_dump(),
                is_active=True,
                created_by=admin.id,
            )
            db.add(nos_scheme)
            db.flush()
            db.add(AuditLog(
                scheme_id=nos_scheme.id, actor_user_id=admin.id,
                action="scheme_created", details={"config_version": 1},
            ))
            print("  ✅ Created NOS scheme")
        else:
            print("  ⏭️  NOS scheme already exists")

        # ── 3. Test Applications ──────────────────────────────────────

        # Check if we already have applications
        existing_apps = db.execute(select(Application)).scalars().all()
        if existing_apps:
            print(f"  ⏭️  {len(existing_apps)} applications already exist, skipping app creation")
            db.commit()
            print("\n✨ Seed complete!")
            return

        # Application 1: NFST — in document_scrutiny state with mixed doc statuses
        app1 = Application(
            scheme_id=nfst_scheme.id,
            applicant_name="Rajesh Kumar Meena",
            applicant_email="rajesh.meena@example.com",
            applicant_phone="+91-9876543210",
            applicant_data={
                "age": 28,
                "annual_income": 450000,
                "category": "ST",
                "qualification": "M.Phil",
                "university": "JNU Delhi",
            },
            current_state="document_scrutiny",
        )
        db.add(app1)
        db.flush()

        # Audit trail for app1
        for action, from_s, to_s in [
            ("application_created", None, "submitted"),
            ("transition", "submitted", "eligibility_check"),
            ("eligibility_check_passed", "eligibility_check", "document_scrutiny"),
        ]:
            db.add(AuditLog(
                application_id=app1.id, scheme_id=nfst_scheme.id,
                actor_user_id=admin.id, action=action,
                from_state=from_s, to_state=to_s,
            ))

        # Documents for app1
        doc1_caste = Document(
            application_id=app1.id, doc_type="caste_certificate",
            storage_key=f"{app1.id}/caste_certificate/demo.pdf",
            status=DocumentStatus.VERIFIED,
            content_type="application/pdf",
            extracted_fields={"certificate_no": "ST/2024/12345", "issuing_authority": "District Collector, Udaipur"},
        )
        doc1_income = Document(
            application_id=app1.id, doc_type="income_certificate",
            storage_key=f"{app1.id}/income_certificate/demo.pdf",
            status=DocumentStatus.DEFICIENT,
            content_type="application/pdf",
            extracted_fields={"annual_income": "450000"},
            deficiency_reasons=[
                {"code": "EXPIRED", "message": "Income certificate has expired (issued more than 1 year ago)"},
                {"code": "MISSING_SEAL", "message": "Official seal not detected on document"},
            ],
        )
        doc1_marksheet = Document(
            application_id=app1.id, doc_type="marksheet",
            storage_key=f"{app1.id}/marksheet/demo.pdf",
            status=DocumentStatus.VERIFIED,
            content_type="application/pdf",
            extracted_fields={"percentage": "72.5", "university": "JNU", "year": "2023"},
        )
        doc1_bonafide = Document(
            application_id=app1.id, doc_type="bonafide_certificate",
            storage_key=f"{app1.id}/bonafide_certificate/demo.pdf",
            status=DocumentStatus.PENDING,
            content_type="application/pdf",
        )
        db.add_all([doc1_caste, doc1_income, doc1_marksheet, doc1_bonafide])
        print("  ✅ Created NFST application (Rajesh Kumar) — in document_scrutiny")

        # Application 2: NFST — in deficient state
        app2 = Application(
            scheme_id=nfst_scheme.id,
            applicant_name="Sunita Bhil",
            applicant_email="sunita.bhil@example.com",
            applicant_phone="+91-9123456789",
            applicant_data={
                "age": 25,
                "annual_income": 350000,
                "category": "ST",
                "qualification": "Ph.D",
                "university": "BHU Varanasi",
            },
            current_state="deficient",
        )
        db.add(app2)
        db.flush()

        for action, from_s, to_s in [
            ("application_created", None, "submitted"),
            ("transition", "submitted", "eligibility_check"),
            ("eligibility_check_passed", "eligibility_check", "document_scrutiny"),
            ("documents_flagged_deficient", "document_scrutiny", "deficient"),
        ]:
            db.add(AuditLog(
                application_id=app2.id, scheme_id=nfst_scheme.id,
                actor_user_id=admin.id, action=action,
                from_state=from_s, to_state=to_s,
            ))

        doc2_caste = Document(
            application_id=app2.id, doc_type="caste_certificate",
            storage_key=f"{app2.id}/caste_certificate/demo.pdf",
            status=DocumentStatus.DEFICIENT,
            content_type="application/pdf",
            deficiency_reasons=[
                {"code": "BLURRY", "message": "Document image is too blurry to read"},
            ],
        )
        doc2_income = Document(
            application_id=app2.id, doc_type="income_certificate",
            storage_key=f"{app2.id}/income_certificate/demo.pdf",
            status=DocumentStatus.DEFICIENT,
            content_type="application/pdf",
            deficiency_reasons=[
                {"code": "MISMATCH", "message": "Name on certificate does not match applicant name"},
            ],
        )
        db.add_all([doc2_caste, doc2_income])
        print("  ✅ Created NFST application (Sunita Bhil) — in deficient state")

        # Application 3: NOS — in selection state (all good)
        app3 = Application(
            scheme_id=nos_scheme.id,
            applicant_name="Priya Devi Paswan",
            applicant_email="priya.paswan@example.com",
            applicant_phone="+91-8765432109",
            applicant_data={
                "qualifying_exam_percent": 78,
                "admission_confirmed": True,
                "age": 27,
                "university_abroad": "University of Oxford",
                "course": "MSc Computer Science",
            },
            current_state="selection",
        )
        db.add(app3)
        db.flush()

        for action, from_s, to_s in [
            ("application_created", None, "submitted"),
            ("transition", "submitted", "eligibility_check"),
            ("eligibility_check_passed", "eligibility_check", "document_scrutiny"),
            ("documents_verified", "document_scrutiny", "selection"),
        ]:
            db.add(AuditLog(
                application_id=app3.id, scheme_id=nos_scheme.id,
                actor_user_id=admin.id, action=action,
                from_state=from_s, to_state=to_s,
            ))

        doc3_passport = Document(
            application_id=app3.id, doc_type="passport",
            storage_key=f"{app3.id}/passport/demo.pdf",
            status=DocumentStatus.VERIFIED,
            content_type="application/pdf",
            extracted_fields={"passport_no": "J1234567", "name": "PRIYA DEVI PASWAN", "expiry": "2030-05-15"},
        )
        doc3_admission = Document(
            application_id=app3.id, doc_type="admission_letter",
            storage_key=f"{app3.id}/admission_letter/demo.pdf",
            status=DocumentStatus.VERIFIED,
            content_type="application/pdf",
            extracted_fields={"university": "University of Oxford", "course": "MSc Computer Science", "start_date": "2025-10-01"},
        )
        doc3_transcript = Document(
            application_id=app3.id, doc_type="degree_transcript",
            storage_key=f"{app3.id}/degree_transcript/demo.pdf",
            status=DocumentStatus.VERIFIED,
            content_type="application/pdf",
            extracted_fields={"percentage": "78", "degree": "B.Tech", "university": "IIT Delhi"},
        )
        db.add_all([doc3_passport, doc3_admission, doc3_transcript])
        print("  ✅ Created NOS application (Priya Devi Paswan) — in selection state")

        # Application 4: NOS — just submitted
        app4 = Application(
            scheme_id=nos_scheme.id,
            applicant_name="Amit Rathore",
            applicant_email="amit.rathore@example.com",
            applicant_data={
                "qualifying_exam_percent": 65,
                "admission_confirmed": True,
                "age": 30,
                "university_abroad": "TU Munich",
                "course": "MSc Data Science",
            },
            current_state="submitted",
        )
        db.add(app4)
        db.flush()
        db.add(AuditLog(
            application_id=app4.id, scheme_id=nos_scheme.id,
            actor_user_id=None, action="application_created",
            from_state=None, to_state="submitted",
        ))
        print("  ✅ Created NOS application (Amit Rathore) — in submitted state")

        db.commit()
        print("\n✨ Seed complete! 2 users, 2 schemes, 4 applications created.")

    except Exception as e:
        db.rollback()
        print(f"\n❌ Seed failed: {e}")
        raise
    finally:
        db.close()


if __name__ == "__main__":
    seed()
