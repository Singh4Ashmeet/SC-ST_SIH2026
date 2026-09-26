"""
=============================================================================
SIH26239 — Master Realistic Data Seeder & MinIO Object Storage Synchronizer
=============================================================================
This script reads the generated synthetic documents and manifest.json from:
  ./synthetic_documents/ (or ../../synthetic_documents/)
and performs a comprehensive, end-to-end synchronization:
  1. Uploads physical PDF files to MinIO object storage (bucket: scholarship-docs).
  2. Populates PostgreSQL with realistic ST applications, documents,
     audit logs, disbursements, and renewals.
  3. Prepares the standard 4 Presentation Scenarios + an expanded cohort of
     30+ realistic applications spanning 15+ Indian states.
  4. Generates demo_context.json for automated testing and live navigation.

Usage:
  python -m scripts.seed_realistic_data
  python -m scripts.seed_realistic_data --skip-minio
  python -m scripts.seed_realistic_data --minio-only
  python -m scripts.seed_realistic_data --db-url "postgresql://user:pass@localhost:5432/scholarship_db"
=============================================================================
"""

import argparse
from datetime import date, datetime, timedelta, timezone
import json
import logging
import mimetypes
import os
from pathlib import Path
import random
import sys
import uuid
from typing import Any, Dict, List, Optional, Tuple

# Ensure backend directory is in sys.path
BACKEND_DIR = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(BACKEND_DIR))

if hasattr(sys.stdout, "reconfigure"):
    sys.stdout.reconfigure(encoding="utf-8", errors="replace")
if hasattr(sys.stderr, "reconfigure"):
    sys.stderr.reconfigure(encoding="utf-8", errors="replace")

logging.basicConfig(level=logging.INFO, format="%(asctime)s [%(levelname)s] %(message)s")
logger = logging.getLogger("seed_realistic_data")

from sqlalchemy import delete, select, text
from sqlalchemy.orm import Session

from app.core.config import get_settings
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
from app.services.storage_service import StorageService

# --------------------------------------------------------------------------
# Paths and Data Locations
# --------------------------------------------------------------------------
PROJECT_ROOT = BACKEND_DIR.parent
SYNTHETIC_DIR = PROJECT_ROOT / "synthetic_documents"
if not SYNTHETIC_DIR.exists():
    SYNTHETIC_DIR = BACKEND_DIR / "synthetic_documents"
MANIFEST_PATH = SYNTHETIC_DIR / "manifest.json"
FIXTURES_DIR = BACKEND_DIR / "app" / "fixtures"

# --------------------------------------------------------------------------
# MinIO Helper
# --------------------------------------------------------------------------
def get_minio_client(settings):
    try:
        import boto3
        from botocore.config import Config
        client = boto3.client(
            "s3",
            endpoint_url=settings.MINIO_ENDPOINT,
            aws_access_key_id=settings.MINIO_ACCESS_KEY,
            aws_secret_access_key=settings.MINIO_SECRET_KEY,
            config=Config(
                signature_version="s3v4",
                connect_timeout=2,
                read_timeout=2,
                retries={"max_attempts": 1}
            ),
            region_name="us-east-1",
        )
        return client
    except Exception as e:
        logger.warning(f"Could not initialize boto3 S3 client: {e}")
        return None


def test_minio_connection(client, bucket_name: str) -> bool:
    if not client:
        return False
    try:
        from botocore.exceptions import ClientError
        try:
            client.head_bucket(Bucket=bucket_name)
        except ClientError as e:
            code = e.response.get("Error", {}).get("Code")
            if code in ("404", "NoSuchBucket"):
                client.create_bucket(Bucket=bucket_name)
                logger.info(f"Created MinIO bucket '{bucket_name}'")
            else:
                return False
        return True
    except Exception as ex:
        logger.warning(f"MinIO connection check failed: {ex}")
        return False


def upload_to_minio(client, bucket_name: str, file_path: Path, storage_key: str) -> bool:
    if not client or not file_path.exists():
        return False
    try:
        with open(file_path, "rb") as f:
            file_bytes = f.read()
        client.put_object(
            Bucket=bucket_name,
            Key=storage_key,
            Body=file_bytes,
            ContentType="application/pdf"
        )
        return True
    except Exception as e:
        logger.error(f"Failed to upload {file_path.name} to {storage_key}: {e}")
        return False


# --------------------------------------------------------------------------
# Load Synthetic Documents Manifest
# --------------------------------------------------------------------------
TYPE_DOC_MAP = {
    1: "caste_certificate",
    2: "income_certificate",
    3: "marksheet",
    4: "bonafide_certificate",
    5: "passport",
    6: "admission_letter",
    7: "degree_transcript",
    8: "ielts_toefl_scorecard",
}

def load_manifest(manifest_path: Path) -> List[Dict[str, Any]]:
    if not manifest_path.exists():
        logger.warning(f"Manifest not found at {manifest_path}!")
        return []
    with open(manifest_path, "r", encoding="utf-8") as f:
        data = json.load(f)
    if isinstance(data, dict) and "documents" in data:
        data = data["documents"]
    elif not isinstance(data, list):
        data = []

    for item in data:
        if "doc_type" not in item:
            t_num = item.get("type")
            if isinstance(t_num, int) and t_num in TYPE_DOC_MAP:
                item["doc_type"] = TYPE_DOC_MAP[t_num]
            elif isinstance(t_num, str) and t_num.isdigit() and int(t_num) in TYPE_DOC_MAP:
                item["doc_type"] = TYPE_DOC_MAP[int(t_num)]
        if "file" not in item:
            item["file"] = item.get("path", "")
        if "variant" not in item:
            v_val = item.get("category", "clean")
            item["variant"] = "clean" if v_val == "clean" else ("noisy" if v_val == "noisy" else "deficient")
        else:
            v_val = item["variant"]
            item["variant"] = "clean" if v_val == "clean" else ("noisy" if v_val == "noisy" else "deficient")
        if "expected_extraction" not in item and "expected_ocr" in item:
            item["expected_extraction"] = item["expected_ocr"]

    logger.info(f"Loaded {len(data)} documents from manifest.")
    return data


# --------------------------------------------------------------------------
# Realistic Demographic Pools
# --------------------------------------------------------------------------
ST_PERSONAS = [
    {"name": "Bikram Kishore Hansda", "gender": "male", "father": "Kishore Hansda", "tribe": "Santhal", "state": "Odisha", "district": "Mayurbhanj", "univ": "Jawaharlal Nehru University", "research": "Mundari & Austroasiatic Phonology"},
    {"name": "Arjun Prakash Sonkar", "gender": "male", "father": "Prakash Sonkar", "tribe": "Bhil", "state": "Madhya Pradesh", "district": "Jhabua", "univ": "Imperial College London", "course": "MSc in Artificial Intelligence"},
    {"name": "Pooja Rameshwar Tirkey", "gender": "female", "father": "Rameshwar Tirkey", "tribe": "Oraon", "state": "Jharkhand", "district": "Ranchi", "univ": "Banaras Hindu University", "research": "Indigenous Botanicals & Medicine"},
    {"name": "Devendra Nath Murmu", "gender": "male", "father": "Nath Murmu", "tribe": "Santhal", "state": "Jharkhand", "district": "Dumka", "univ": "National University of Singapore", "course": "Master of Computing"},
    {"name": "Kavita Ramesh Soren", "gender": "female", "father": "Ramesh Soren", "tribe": "Santhal", "state": "Jharkhand", "district": "Khunti", "univ": "Ranchi University", "research": "Tribal Land Rights and Customary Law"},
    {"name": "Tanvi Siddharth Kamble", "gender": "female", "father": "Siddharth Kamble", "tribe": "Gond", "state": "Maharashtra", "district": "Gadchiroli", "univ": "ETH Zurich", "course": "MSc Robotics, Systems and Control"},
    {"name": "Manish Kumar Gond", "gender": "male", "father": "Kumar Gond", "tribe": "Gond", "state": "Chhattisgarh", "district": "Bastar", "univ": "Gauhati University", "research": "Biodiversity Conservation in Central India"},
    {"name": "Birsa Mangal Munda", "gender": "male", "father": "Mangal Munda", "tribe": "Munda", "state": "Jharkhand", "district": "Khunti", "univ": "University of Delhi", "research": "Tribal Freedom Movement Historiography"},
    {"name": "Sunita Suresh Meena", "gender": "female", "father": "Suresh Meena", "tribe": "Meena", "state": "Rajasthan", "district": "Udaipur", "univ": "Central University of Rajasthan", "research": "Solar Energy Integration in Rural Grids"},
    {"name": "Rajesh Dilip Bhil", "gender": "male", "father": "Dilip Bhil", "tribe": "Bhil", "state": "Gujarat", "district": "Dang", "univ": "University of Oxford", "course": "MSc Water Science, Policy and Management"},
    {"name": "Meera Somra Kharia", "gender": "female", "father": "Somra Kharia", "tribe": "Kharia", "state": "Odisha", "district": "Sundargarh", "univ": "Sambalpur University", "research": "Documentation of Endangered Austroasiatic Dialects"},
    {"name": "Lalremruata Thangkhanlian", "gender": "male", "father": "Thangkhanlian", "tribe": "Kuki-Chin", "state": "Mizoram", "district": "Aizawl", "univ": "North-Eastern Hill University", "research": "Ethno-botanical Formulations of Mizoram"},
    {"name": "Vanlalruati Padmini", "gender": "female", "father": "Padmini", "tribe": "Mizo", "state": "Mizoram", "district": "Lunglei", "univ": "University of Melbourne", "course": "Master of Public Health"},
    {"name": "Ananya Mohan Toppo", "gender": "female", "father": "Mohan Toppo", "tribe": "Oraon", "state": "Chhattisgarh", "district": "Jashpur", "univ": "Tezpur University", "research": "Renewable Micro-grids for Forest Communities"},
    {"name": "Sanjay Harihar Marandi", "gender": "male", "father": "Harihar Marandi", "tribe": "Santhal", "state": "West Bengal", "district": "Purulia", "univ": "Visva-Bharati University", "research": "Traditional Santhal Terracotta & Metal Crafts"},
    {"name": "Dayamani Lakra", "gender": "female", "father": "Lakhanlal Lakra", "tribe": "Oraon", "state": "Jharkhand", "district": "Gumla", "univ": "Tata Institute of Social Sciences", "research": "Tribal Livelihoods & Forest Rights Act"},
    {"name": "Budhan Ajay Kisku", "gender": "male", "father": "Ajay Kisku", "tribe": "Santhal", "state": "Bihar", "district": "Kishanganj", "univ": "University of Hyderabad", "research": "Sociolinguistic Profile of Eastern Tribal Belts"},
    {"name": "Phulmani Ekka", "gender": "female", "father": "Manoj Ekka", "tribe": "Oraon", "state": "Chhattisgarh", "district": "Surguja", "univ": "Technical University of Munich", "course": "MSc Environmental Engineering"},
    {"name": "Vikram Dhananjay Baiga", "gender": "male", "father": "Dhananjay Baiga", "tribe": "Baiga", "state": "Madhya Pradesh", "district": "Dindori", "univ": "Indira Gandhi National Tribal University", "research": "Indigenous Medicinal Plants of Amarkantak"},
    {"name": "Laxmi Balram Minz", "gender": "female", "father": "Balram Minz", "tribe": "Oraon", "state": "Odisha", "district": "Rayagada", "univ": "Utkal University", "research": "Tribal Maternal Health Interventions"},
    {"name": "Hemant Budhan Rathore", "gender": "male", "father": "Budhan Rathore", "tribe": "Bhil", "state": "Rajasthan", "district": "Banswara", "univ": "National University of Ireland, Galway", "course": "MSc Climate Change & Agriculture"},
    {"name": "Jyoti Jaipal Barla", "gender": "female", "father": "Jaipal Barla", "tribe": "Munda", "state": "Jharkhand", "district": "Simdega", "univ": "Ranchi University", "research": "Hockey & Athletic Culture in Chotanagpur Tribes"},
    {"name": "Deepak Santosh Korwa", "gender": "male", "father": "Santosh Korwa", "tribe": "Hill Korwa", "state": "Chhattisgarh", "district": "Korba", "univ": "Guru Ghasidas Vishwavidyalaya", "research": "Sedentarization of Vulnerable Tribal Groups"},
    {"name": "Geeta Birsa Minz", "gender": "female", "father": "Birsa Minz", "tribe": "Oraon", "state": "Jharkhand", "district": "Lohardaga", "univ": "Central University of Jharkhand", "research": "Sustainable Agriculture in Bauxite Mining Zones"},
    {"name": "Ravi Vanlalruati Kongari", "gender": "male", "father": "Vanlalruati Kongari", "tribe": "Kharia", "state": "Odisha", "district": "Sundargarh", "univ": "University of Edinburgh", "course": "MSc Computational Applied Mathematics"}
]


def seed_database(db_url: Optional[str] = None, skip_minio: bool = False, minio_only: bool = False):
    settings = get_settings()
    effective_db_url = db_url or os.environ.get("DATABASE_URL") or settings.DATABASE_URL
    from sqlalchemy import create_engine
    from sqlalchemy.orm import sessionmaker
    target_engine = create_engine(effective_db_url, pool_pre_ping=True)
    TargetSession = sessionmaker(autocommit=False, autoflush=False, bind=target_engine)
    db = TargetSession()

    # MinIO initialization
    minio_client = get_minio_client(settings)
    minio_available = False
    if not skip_minio and minio_client:
        minio_available = test_minio_connection(minio_client, settings.MINIO_BUCKET_NAME)
        if minio_available:
            logger.info(f"Connected to MinIO at {settings.MINIO_ENDPOINT} (Bucket: '{settings.MINIO_BUCKET_NAME}').")
        else:
            logger.warning(f"MinIO bucket '{settings.MINIO_BUCKET_NAME}' could not be verified.")
    else:
        logger.warning("MinIO synchronization is skipped or client unavailable.")

    # Load synthetic documents manifest
    manifest_entries = load_manifest(MANIFEST_PATH)
    manifest_by_doctype: Dict[str, Dict[str, List[Dict[str, Any]]]] = {}
    for entry in manifest_entries:
        dtype = entry.get("doc_type")
        var = entry.get("variant", "clean")
        manifest_by_doctype.setdefault(dtype, {}).setdefault(var, []).append(entry)

    doc_pointers: Dict[str, Dict[str, int]] = {}

    def get_manifest_doc(doctype: str, variant: str = "clean") -> Optional[Dict[str, Any]]:
        pool = manifest_by_doctype.get(doctype, {}).get(variant, [])
        if not pool:
            # Fallback to any variant
            all_pools = [p for p in manifest_by_doctype.get(doctype, {}).values() if p]
            if not all_pools:
                return None
            pool = all_pools[0]
        idx = doc_pointers.setdefault(doctype, {}).setdefault(variant, 0)
        chosen = pool[idx % len(pool)]
        doc_pointers[doctype][variant] = idx + 1
        return chosen

    # Connect to PostgreSQL
    try:
        if minio_only:
            logger.info("\n" + "=" * 80)
            logger.info("  MINIO SYNC ONLY MODE: Uploading PDFs for existing Document rows")
            logger.info("=" * 80)
            if not minio_available:
                logger.error("MinIO is not reachable. Please start MinIO before running --minio-only.")
                return
            docs = db.execute(select(Document)).scalars().all()
            logger.info(f"Found {len(docs)} documents in database to sync.")
            synced = 0
            for doc in docs:
                variant = "clean"
                if doc.status == DocumentStatus.DEFICIENT:
                    variant = "deficient"
                m_doc = get_manifest_doc(doc.doc_type, variant)
                if m_doc:
                    raw_path_str = m_doc.get("file", "")
                    pdf_path = SYNTHETIC_DIR.parent / raw_path_str
                    if not pdf_path.exists():
                        pdf_path = SYNTHETIC_DIR / Path(raw_path_str).name
                    if not pdf_path.exists():
                        pdf_path = SYNTHETIC_DIR / raw_path_str
                    if pdf_path.exists():
                        if upload_to_minio(minio_client, settings.MINIO_BUCKET_NAME, pdf_path, doc.storage_key):
                            synced += 1
            logger.info(f"Successfully uploaded {synced}/{len(docs)} PDF files to MinIO bucket '{settings.MINIO_BUCKET_NAME}'.")
            return

        logger.info("\n" + "=" * 80)
        logger.info("  SIH26239: MASTER REALISTIC DATA & DOCUMENT SEED")
        logger.info("=" * 80)

        # 1. Cleanup Old Demo Records
        logger.info("[1/7] Cleaning up existing demo/synthetic applications...")
        demo_emails_to_clean = [
            "%@demo.scholarship.gov.in",
            "%@scholar.in",
            "rajesh.meena@example.com",
            "sunita.bhil@example.com",
            "priya.paswan@example.com",
            "amit.rathore@example.com",
        ]
        deleted_count = 0
        for pat in demo_emails_to_clean:
            apps = db.execute(select(Application).where(Application.applicant_email.like(pat))).scalars().all()
            for a in apps:
                db.delete(a)
                deleted_count += 1
        db.commit()
        logger.info(f"  Cleaned {deleted_count} old demo applications.")

        # 2. Provision Core Users
        logger.info("[2/7] Provisioning Core Administrative Users...")
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
            existing = db.execute(select(User).where(User.email == ucfg["email"])).scalar_one_or_none()
            if existing:
                existing.full_name = ucfg["name"]
                existing.role = ucfg["role"]
                existing.hashed_password = hash_password(ucfg["password"])
                existing.is_active = True
                user_map[ucfg["role"]] = existing
            else:
                nu = User(
                    email=ucfg["email"],
                    hashed_password=hash_password(ucfg["password"]),
                    full_name=ucfg["name"],
                    role=ucfg["role"],
                    is_active=True,
                )
                db.add(nu)
                db.flush()
                user_map[ucfg["role"]] = nu
        db.commit()
        admin_user = user_map[UserRole.SUPER_ADMIN]
        scrutiny_user = user_map[UserRole.SCRUTINY_OFFICER]
        selection_user = user_map[UserRole.SELECTION_COMMITTEE]
        scheme_admin_user = user_map[UserRole.SCHEME_ADMIN]

        # 3. Provision Schemes
        logger.info("[3/7] Provisioning NFST & NOS Schemes from Fixtures...")
        with open(FIXTURES_DIR / "nfst_config.json", "r", encoding="utf-8") as f:
            nfst_raw = json.load(f)
        nfst_validated = validate_scheme_config(nfst_raw)

        with open(FIXTURES_DIR / "nos_config.json", "r", encoding="utf-8") as f:
            nos_raw = json.load(f)
        nos_validated = validate_scheme_config(nos_raw)

        nfst_scheme = db.execute(select(Scheme).where(Scheme.code == "NFST")).scalar_one_or_none()
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
            db.add(AuditLog(scheme_id=nfst_scheme.id, actor_user_id=admin_user.id, action="scheme_created", details={"config_version": 1}))
        else:
            nfst_scheme.config = nfst_validated.model_dump()
            nfst_scheme.is_active = True

        nos_scheme = db.execute(select(Scheme).where(Scheme.code == "NOS")).scalar_one_or_none()
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
            db.add(AuditLog(scheme_id=nos_scheme.id, actor_user_id=admin_user.id, action="scheme_created", details={"config_version": 1}))
        else:
            nos_scheme.config = nos_validated.model_dump()
            nos_scheme.is_active = True
        db.commit()

        # 4. Helper Function to Attach Realistic Documents & Sync to MinIO
        uploaded_files_count = 0

        def attach_real_document(
            app: Application,
            doctype: str,
            variant: str,
            status: DocumentStatus,
            custom_extractions: Optional[Dict[str, Any]] = None,
            custom_deficiencies: Optional[List[Dict[str, Any]]] = None,
        ) -> Document:
            nonlocal uploaded_files_count
            manifest_doc = get_manifest_doc(doctype, variant)
            doc_id = uuid.uuid4()
            filename = f"{doctype}_{variant}_{str(doc_id)[:8]}.pdf"
            storage_key = f"{app.id}/{doctype}/{filename}"

            extracted_fields = custom_extractions or {}
            deficiency_reasons = custom_deficiencies or []

            # Populate from manifest if available
            if manifest_doc:
                raw_path_str = manifest_doc.get("file", "")
                actual_pdf_path = SYNTHETIC_DIR.parent / raw_path_str
                if not actual_pdf_path.exists():
                    actual_pdf_path = SYNTHETIC_DIR / Path(raw_path_str).name
                if not actual_pdf_path.exists():
                    actual_pdf_path = SYNTHETIC_DIR / raw_path_str

                # If physical file exists and MinIO is connected, upload it!
                if minio_available and actual_pdf_path.exists():
                    ok = upload_to_minio(minio_client, settings.MINIO_BUCKET_NAME, actual_pdf_path, storage_key)
                    if ok:
                        uploaded_files_count += 1

                # Extracted fields from manifest
                if not extracted_fields and "expected_extraction" in manifest_doc:
                    extracted_fields = manifest_doc["expected_extraction"]

                # Deficiencies from manifest
                if status == DocumentStatus.DEFICIENT and not deficiency_reasons:
                    dtype_def = manifest_doc.get("deficiency_type", "format_invalid")
                    if dtype_def == "expired_date":
                        deficiency_reasons.append({
                            "code": "EXPIRED_DATE",
                            "field": "issue_date",
                            "message": f"Certificate date ({manifest_doc.get('fields', {}).get('Issue Date', '2023')}) has expired (>365 days).",
                        })
                    elif dtype_def == "missing_authority":
                        deficiency_reasons.append({
                            "code": "MISSING_FIELD",
                            "field": "issuing_authority",
                            "message": "Issuing authority stamp or digital signature is missing.",
                        })
                    elif dtype_def == "missing_category":
                        deficiency_reasons.append({
                            "code": "MISSING_FIELD",
                            "field": "category",
                            "message": "Scheduled Tribe (ST) category declaration is not explicitly stated.",
                        })
                    else:
                        deficiency_reasons.append({
                            "code": "FORMAT_INVALID",
                            "field": "certificate_number",
                            "message": "Certificate number format does not comply with state standards.",
                        })

            doc = Document(
                id=doc_id,
                application_id=app.id,
                doc_type=doctype,
                storage_key=storage_key,
                status=status,
                content_type="application/pdf",
                extracted_fields=extracted_fields if extracted_fields else None,
                deficiency_reasons=deficiency_reasons if deficiency_reasons else None,
                uploaded_at=datetime.now(timezone.utc) - timedelta(days=random.randint(5, 45)),
                reviewed_at=datetime.now(timezone.utc) - timedelta(days=random.randint(1, 4)) if status != DocumentStatus.PENDING else None,
            )
            db.add(doc)
            return doc

        # ---------------------------------------------------------------------
        # 5. Core Presentation Scenarios (Scenarios 1 to 4)
        # ---------------------------------------------------------------------
        logger.info("[4/7] Seeding Core Presentation Scenarios (with real PDF links)...")
        demo_summary_records = []

        # SCENARIO 1: Golden Path NFST
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

        for action, from_s, to_s, actor_id, details in [
            ("application_created", None, "submitted", None, {"submission_channel": "web_portal"}),
            ("transition", "submitted", "eligibility_check", None, {"trigger": "auto_evaluate"}),
            ("eligibility_check_passed", "eligibility_check", "document_scrutiny", None, {"trigger": "eligibility_passed", "checks": ["age <= 36 (27)", "annual_income <= 600000 (380000)", "category == 'ST'"]}),
            ("documents_verified", "document_scrutiny", "selection", scrutiny_user.id, {"verified_documents_count": 4, "officer_notes": "All original certificates matched state records."}),
            ("committee_approved", "selection", "approved", selection_user.id, {"committee_score": 94.5, "resolution": "Unanimously selected for 5-year doctoral fellowship."}),
        ]:
            db.add(AuditLog(application_id=app1.id, scheme_id=nfst_scheme.id, actor_user_id=actor_id, action=action, from_state=from_s, to_state=to_s, details=details))

        attach_real_document(app1, "caste_certificate", "clean", DocumentStatus.VERIFIED, custom_extractions={"applicant_name": "Bikram Kishore Hansda", "category": "ST", "issuing_authority": "Sub-Collector, Mayurbhanj", "issue_date": "2024-03-12"})
        attach_real_document(app1, "income_certificate", "clean", DocumentStatus.VERIFIED, custom_extractions={"applicant_name": "Bikram Kishore Hansda", "annual_income": "380000", "issuing_authority": "Tahasildar, Baripada", "issue_date": "2025-06-10"})
        attach_real_document(app1, "marksheet", "clean", DocumentStatus.VERIFIED, custom_extractions={"student_name": "Bikram Kishore Hansda", "percentage": "79.2", "board_or_university": "JNU Delhi", "exam_year": "2024"})
        attach_real_document(app1, "bonafide_certificate", "clean", DocumentStatus.VERIFIED, custom_extractions={"student_name": "Bikram Kishore Hansda", "institution_name": "Jawaharlal Nehru University", "course": "Ph.D Linguistics", "academic_year": "2025-26"})

        db.add(Disbursement(
            application_id=app1.id,
            amount=180000.0,
            status=DisbursementStatus.DISBURSED,
            disbursed_date=date(2026, 8, 15),
            installment_number=1,
            remarks="Tranche 1 (Stipend INR 1,50,000 + Contingency INR 30,000) remitted via PFMS/DBT (Ref: PFMS2026081500412)",
            created_by=admin_user.id,
        ))
        db.add(Disbursement(
            application_id=app1.id,
            amount=180000.0,
            status=DisbursementStatus.PENDING,
            installment_number=2,
            remarks="Tranche 2 (Academic Year 2026-27 - Q3 & Q4 stipend) queued for release",
            created_by=admin_user.id,
        ))
        db.add(Renewal(
            application_id=app1.id,
            academic_year_or_cycle="2026-27",
            status=RenewalStatus.APPROVED,
            due_date=date(2026, 8, 1),
            reviewed_date=date(2026, 8, 10),
            reviewer_id=selection_user.id,
            remarks="Initial doctoral admission and supervisor allocation verified. Approved for Year 1.",
        ))
        demo_summary_records.append({
            "scenario": "Scenario 1 (Golden Path NFST)",
            "scheme": "NFST",
            "applicant": app1.applicant_name,
            "id": str(app1.id),
            "state": app1.current_state,
            "description": "Full lifecycle completed: automated eligibility -> verified docs -> committee approval -> disbursed tranche -> active renewal.",
        })

        # SCENARIO 2: Golden Path NOS
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
            ("eligibility_check_passed", "eligibility_check", "document_scrutiny", None, {"trigger": "eligibility_passed", "checks": ["qualifying_exam_percent >= 60 (84.5)", "admission_confirmed == true", "age <= 35 (28)"]}),
            ("documents_verified", "document_scrutiny", "selection", scrutiny_user.id, {"verified_documents_count": 3, "officer_notes": "Passport and unconditional admission validated."}),
            ("committee_approved", "selection", "approved", selection_user.id, {"committee_score": 96.0, "resolution": "Awarded full overseas scholarship under Engineering & Tech quota."}),
        ]:
            db.add(AuditLog(application_id=app2.id, scheme_id=nos_scheme.id, actor_user_id=actor_id, action=action, from_state=from_s, to_state=to_s, details=details))

        attach_real_document(app2, "passport", "clean", DocumentStatus.VERIFIED, custom_extractions={"full_name": "ARJUN PRAKASH SONKAR", "passport_number": "Z8921345", "expiry_date": "2032-11-20"})
        attach_real_document(app2, "admission_letter", "clean", DocumentStatus.VERIFIED, custom_extractions={"applicant_name": "Arjun Prakash Sonkar", "institution_name": "Imperial College London", "program": "MSc Artificial Intelligence", "admission_date": "2026-09-28"})
        attach_real_document(app2, "degree_transcript", "clean", DocumentStatus.VERIFIED, custom_extractions={"student_name": "Arjun Prakash Sonkar", "percentage": "84.5", "university": "IIT Roorkee", "graduation_year": "2023"})

        db.add(Disbursement(
            application_id=app2.id,
            amount=1500000.0,
            status=DisbursementStatus.DISBURSED,
            disbursed_date=date(2026, 9, 5),
            installment_number=1,
            remarks="Tuition fees installment 1 remitted directly to Imperial College London international wire account",
            created_by=admin_user.id,
        ))
        db.add(Renewal(
            application_id=app2.id,
            academic_year_or_cycle="2026-27",
            status=RenewalStatus.APPROVED,
            due_date=date(2027, 4, 30),
            reviewed_date=date(2026, 9, 10),
            reviewer_id=selection_user.id,
            remarks="Overseas academic mentor verification certificate validated. Approved.",
        ))
        demo_summary_records.append({
            "scenario": "Scenario 2 (Golden Path NOS)",
            "scheme": "NOS",
            "applicant": app2.applicant_name,
            "id": str(app2.id),
            "state": app2.current_state,
            "description": "Proves scheme configurability: identical engine handles different workflow rules, criteria, and international documents.",
        })

        # SCENARIO 3: Unhappy Path NFST (Deficient Documents)
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
            ("documents_flagged_deficient", "document_scrutiny", "deficient", scrutiny_user.id, {
                "trigger": "documents_flagged_deficient",
                "flagged_documents_count": 2,
                "reasons": [
                    "income_certificate: EXPIRED_DATE, FORMAT_INVALID, MISSING_FIELD",
                    "caste_certificate: MISSING_FIELD, FORMAT_INVALID",
                ],
            }),
        ]:
            db.add(AuditLog(application_id=app3.id, scheme_id=nfst_scheme.id, actor_user_id=actor_id, action=action, from_state=from_s, to_state=to_s, details=details))

        attach_real_document(
            app3, "income_certificate", "deficient", DocumentStatus.DEFICIENT,
            custom_extractions={"issue_date": "2023-01-15", "annual_income": "-50000"},
            custom_deficiencies=[
                {"code": "EXPIRED_DATE", "field": "issue_date", "message": "Document expired on 2024-01-15 (issued 2023-01-15; certificates older than 1 year are invalid)."},
                {"code": "FORMAT_INVALID", "field": "annual_income", "message": "annual_income must be a valid positive number, got: -50000"},
                {"code": "MISSING_FIELD", "field": "issuing_authority", "message": "Required field 'issuing_authority' is missing or unreadable."},
            ]
        )
        attach_real_document(
            app3, "caste_certificate", "deficient", DocumentStatus.DEFICIENT,
            custom_extractions={"certificate_no": "ST/TEMP/0091"},
            custom_deficiencies=[
                {"code": "MISSING_FIELD", "field": "category", "message": "Required field 'category' is missing or not identified as ST."},
                {"code": "FORMAT_INVALID", "field": "issue_date", "message": "issue_date must be a valid date (DD/MM/YYYY), got: UNREADABLE_BLUR"},
            ]
        )
        attach_real_document(app3, "marksheet", "clean", DocumentStatus.VERIFIED, custom_extractions={"student_name": "Pooja Rameshwar Tirkey", "percentage": "78.4", "board_or_university": "BHU Varanasi", "exam_year": "2024"})
        attach_real_document(app3, "bonafide_certificate", "clean", DocumentStatus.VERIFIED, custom_extractions={"student_name": "Pooja Rameshwar Tirkey", "institution_name": "Banaras Hindu University", "course": "Ph.D Indigenous Botanicals", "academic_year": "2025-26"})

        demo_summary_records.append({
            "scenario": "Scenario 3 (Unhappy Path NFST)",
            "scheme": "NFST",
            "applicant": app3.applicant_name,
            "id": str(app3.id),
            "state": app3.current_state,
            "description": "Crucial live demo: stacked deficiency reasons (EXPIRED_DATE, FORMAT_INVALID, MISSING_FIELD). Ready for live resubmission.",
        })

        # SCENARIO 4: Ineligible NOS Path
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
            ("eligibility_check_failed", "eligibility_check", "rejected", None, {
                "trigger": "eligibility_failed",
                "failed_rules_count": 3,
                "failed_rules": [
                    {"rule": "qualifying_exam_percent >= 60", "actual": 52.0, "failure_message": "Minimum 60% aggregate marks required in qualifying degree."},
                    {"rule": "admission_confirmed == true", "actual": False, "failure_message": "Unconditional foreign university admission offer required."},
                    {"rule": "age <= 35", "actual": 42, "failure_message": "Applicant age must not exceed 35 years."},
                ],
            }),
        ]:
            db.add(AuditLog(application_id=app4.id, scheme_id=nos_scheme.id, actor_user_id=actor_id, action=action, from_state=from_s, to_state=to_s, details=details))

        demo_summary_records.append({
            "scenario": "Scenario 4 (Ineligible NOS)",
            "scheme": "NOS",
            "applicant": app4.applicant_name,
            "id": str(app4.id),
            "state": app4.current_state,
            "description": "Demonstrates automated eligibility evaluation catching 3 failing rules simultaneously with transparent audit logs.",
        })

        db.commit()

        # ---------------------------------------------------------------------
        # 6. Expanded Realistic Cohort (30+ Applications across India)
        # ---------------------------------------------------------------------
        logger.info("[5/7] Seeding Expanded Cohort across 15+ States and Lifecycle States...")
        lifecycle_states = ["submitted", "eligibility_check", "document_scrutiny", "deficient", "selection", "approved", "disbursed"]

        cohort_count = 0
        for i, persona in enumerate(ST_PERSONAS[4:], start=5):
            is_nos = "university_abroad" in persona or "course" in persona
            assigned_scheme = nos_scheme if is_nos else nfst_scheme
            target_state = lifecycle_states[i % len(lifecycle_states)]

            email_slug = persona["name"].lower().replace(" ", ".")
            app = Application(
                scheme_id=assigned_scheme.id,
                applicant_name=persona["name"],
                applicant_email=f"{email_slug}@demo.scholarship.gov.in",
                applicant_phone=f"+91-98765{i:05d}",
                applicant_data={
                    "age": random.randint(23, 34),
                    "category": "ST",
                    "tribe": persona["tribe"],
                    "state": persona["state"],
                    "district": persona["district"],
                    "annual_income": random.choice([240000, 310000, 420000, 520000, 580000]),
                    "university": persona.get("univ", "Central University"),
                    "qualifying_exam_percent": round(random.uniform(68.0, 92.5), 1),
                    "admission_confirmed": True,
                    "is_demo": True,
                },
                current_state=target_state,
            )
            db.add(app)
            db.flush()

            # Audit Trail
            db.add(AuditLog(application_id=app.id, scheme_id=assigned_scheme.id, action="application_created", from_state=None, to_state="submitted"))
            if target_state != "submitted":
                db.add(AuditLog(application_id=app.id, scheme_id=assigned_scheme.id, action="transition", from_state="submitted", to_state="eligibility_check"))
            if target_state not in ("submitted", "eligibility_check"):
                db.add(AuditLog(application_id=app.id, scheme_id=assigned_scheme.id, action="eligibility_check_passed", from_state="eligibility_check", to_state="document_scrutiny"))
            if target_state in ("selection", "approved", "disbursed"):
                db.add(AuditLog(application_id=app.id, scheme_id=assigned_scheme.id, action="documents_verified", from_state="document_scrutiny", to_state="selection", actor_user_id=scrutiny_user.id))
            if target_state in ("approved", "disbursed"):
                db.add(AuditLog(application_id=app.id, scheme_id=assigned_scheme.id, action="committee_approved", from_state="selection", to_state="approved", actor_user_id=selection_user.id, details={"score": round(random.uniform(85, 98), 1)}))

            # Documents
            variant = "clean"
            doc_status = DocumentStatus.VERIFIED if target_state in ("selection", "approved", "disbursed") else DocumentStatus.PENDING
            if target_state == "deficient":
                variant = "deficient"
                doc_status = DocumentStatus.DEFICIENT
            elif target_state == "document_scrutiny" and (i % 3 == 0):
                variant = "noisy"  # Tests OCR on noisy scan

            if not is_nos:
                attach_real_document(app, "caste_certificate", variant, doc_status)
                attach_real_document(app, "income_certificate", variant, doc_status)
                attach_real_document(app, "marksheet", "clean", doc_status)
                attach_real_document(app, "bonafide_certificate", "clean", doc_status)
            else:
                attach_real_document(app, "passport", "clean", doc_status)
                attach_real_document(app, "admission_letter", variant, doc_status)
                attach_real_document(app, "degree_transcript", "clean", doc_status)
                attach_real_document(app, "ielts_toefl_scorecard", "clean", doc_status)

            # Disbursements for Approved / Disbursed
            if target_state in ("approved", "disbursed"):
                db.add(Disbursement(
                    application_id=app.id,
                    amount=180000.0 if not is_nos else 1250000.0,
                    status=DisbursementStatus.DISBURSED if target_state == "disbursed" else DisbursementStatus.PENDING,
                    disbursed_date=date(2026, 7, 20) if target_state == "disbursed" else None,
                    installment_number=1,
                    remarks="Installment 1 processed via PFMS/DBT Direct Bank Transfer",
                    created_by=admin_user.id,
                ))
                db.add(Renewal(
                    application_id=app.id,
                    academic_year_or_cycle="2026-27",
                    status=RenewalStatus.APPROVED,
                    due_date=date(2026, 8, 1),
                    reviewed_date=date(2026, 8, 5),
                    reviewer_id=selection_user.id,
                    remarks="Annual progress milestones verified.",
                ))

            cohort_count += 1

        db.commit()
        logger.info(f"  Successfully seeded {cohort_count} additional realistic applications.")

        # ---------------------------------------------------------------------
        # 7. Update demo_context.json
        # ---------------------------------------------------------------------
        logger.info("[6/7] Generating updated demo_context.json...")
        demo_context_path = BACKEND_DIR.parent / "demo_context.json"
        demo_context_data = {
            "credentials": {ucfg["role"].value: {"email": ucfg["email"], "password": ucfg["password"], "name": ucfg["name"]} for ucfg in users_config},
            "scenarios": {rec["scenario"].split()[0].lower() if "Scenario" in rec["scenario"] else rec["scenario"]: rec for rec in demo_summary_records},
            "applications": demo_summary_records,
            "minio": {
                "endpoint": settings.MINIO_ENDPOINT,
                "bucket": settings.MINIO_BUCKET_NAME,
                "uploaded_files_count": uploaded_files_count,
            },
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
            }
        }
        with open(demo_context_path, "w", encoding="utf-8") as f:
            json.dump(demo_context_data, f, indent=2)
        logger.info(f"  Saved demo context to: {demo_context_path.name}")

        # Summary
        logger.info("\n" + "=" * 80)
        logger.info("  DEMO & REALISTIC DATA SEED COMPLETED SUCCESSFULLY")
        logger.info(f"  • Total Applications Seeded: {cohort_count + 4}")
        logger.info(f"  • Physical PDF Files Synced to MinIO: {uploaded_files_count}")
        logger.info("=" * 80)

    except Exception as e:
        db.rollback()
        logger.error(f"Seeding failed: {e}", exc_info=True)
        raise
    finally:
        db.close()


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="Seed realistic ST scholarship data into PostgreSQL and MinIO.")
    parser.add_argument("--db-url", type=str, default=None, help="Database connection URL")
    parser.add_argument("--skip-minio", action="store_true", help="Skip uploading physical PDFs to MinIO")
    parser.add_argument("--minio-only", action="store_true", help="Only upload PDFs to MinIO without modifying database")
    args = parser.parse_args()

    seed_database(db_url=args.db_url, skip_minio=args.skip_minio, minio_only=args.minio_only)
