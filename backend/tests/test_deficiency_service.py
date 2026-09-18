"""
Tests for deficiency detection service.

Uses hand-written synthetic extracted_fields dicts to test the rule-based checks.
"""

import json
import uuid
from datetime import datetime, timedelta
from pathlib import Path
from typing import Any, Dict, List, Optional

import pytest
from sqlalchemy import create_engine, JSON, String, Text, DateTime, func, ForeignKey, Enum
from sqlalchemy.dialects.postgresql import UUID as PG_UUID
from sqlalchemy.orm import sessionmaker, DeclarativeBase, Mapped, mapped_column, relationship

from app.models.document import DocumentStatus
from app.schemas.scheme_config import SchemeConfig, RequiredDocument
from app.services.deficiency_service import check_document, check_application_documents, DeficiencyCheck
from app.services.scheme_config_validator import validate_scheme_config
from app.models.document import Document as DocumentModel
from app.models.application import Application
from app.models.scheme import Scheme


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


class TestUser(TestBase, TestBaseModelMixin):
    __tablename__ = "users"
    email: Mapped[str] = mapped_column(String(255), unique=True, index=True, nullable=False)
    hashed_password: Mapped[str] = mapped_column(String(255), nullable=False)
    full_name: Mapped[str] = mapped_column(String(255), nullable=False)
    role: Mapped[str] = mapped_column(String(50), nullable=False)
    is_active: Mapped[bool] = mapped_column(default=True, server_default="true", nullable=False)


class TestScheme(TestBase, TestBaseModelMixin):
    __tablename__ = "schemes"
    code: Mapped[str] = mapped_column(String(50), unique=True, index=True, nullable=False)
    name: Mapped[str] = mapped_column(String(255), nullable=False)
    description: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    config: Mapped[dict] = mapped_column(JSON, nullable=False, default=dict)
    is_active: Mapped[bool] = mapped_column(default=True, nullable=False)
    created_by: Mapped[Optional[uuid.UUID]] = mapped_column(PG_UUID(as_uuid=True), nullable=True)

    # Relationship
    applications: Mapped[List["TestApplication"]] = relationship("TestApplication", back_populates="scheme")


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

    # Relationship
    scheme: Mapped["TestScheme"] = relationship("TestScheme", back_populates="applications")


class TestDocument(TestBase, TestBaseModelMixin):
    __tablename__ = "documents"
    application_id: Mapped[uuid.UUID] = mapped_column(
        PG_UUID(as_uuid=True), ForeignKey("applications.id", ondelete="CASCADE"), index=True, nullable=False
    )
    doc_type: Mapped[str] = mapped_column(String(100), nullable=False)
    storage_key: Mapped[str] = mapped_column(String(500), nullable=False)
    content_type: Mapped[str] = mapped_column(String(100), nullable=True, default="application/octet-stream")
    status: Mapped[str] = mapped_column(Enum(DocumentStatus, name="document_status"), default=DocumentStatus.PENDING, nullable=False)
    extracted_fields: Mapped[Optional[Any]] = mapped_column(JSON, nullable=True)
    deficiency_reasons: Mapped[Optional[Any]] = mapped_column(JSON, nullable=True)
    uploaded_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), nullable=False)
    reviewed_at: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True), nullable=True)


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


TEST_DB_URL = "sqlite:///./test_deficiency.db"
engine = create_engine(TEST_DB_URL, connect_args={"check_same_thread": False})
TestingSessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)


def load_fixture(filename: str) -> Dict[str, Any]:
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


def _create_test_scheme(db, code: str, config_data: dict) -> TestScheme:
    """Helper to create a test scheme."""
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


def _create_test_application(db, scheme: TestScheme, config_data: dict) -> TestApplication:
    """Helper to create a test application."""
    config = validate_scheme_config(config_data)
    app = TestApplication(
        scheme_id=scheme.id,
        applicant_name="Test Applicant",
        applicant_email="test@example.com",
        applicant_data={"age": 25, "annual_income": 300000, "category": "ST"},
        current_state=config.initial_state,
    )
    db.add(app)
    db.commit()
    db.refresh(app)
    return app


def _create_test_document(db, application: TestApplication, doc_type: str, extracted_fields: dict) -> TestDocument:
    """Helper to create a test document with pre-set extracted_fields."""
    doc = TestDocument(
        application_id=application.id,
        doc_type=doc_type,
        storage_key=f"app-id/{doc_type}/uuid.pdf",
        status=DocumentStatus.PENDING,
        extracted_fields=extracted_fields,
    )
    db.add(doc)
    db.commit()
    db.refresh(doc)
    return doc


class TestDeficiencyService:
    """Unit tests for deficiency detection service."""

    @pytest.fixture
    def nfst_config(self) -> dict:
        return load_fixture("nfst_config.json")

    @pytest.fixture
    def scheme_config(self, nfst_config) -> SchemeConfig:
        return validate_scheme_config(nfst_config)

    # ===== Clean document tests =====

    def test_clean_caste_certificate_not_deficient(self, scheme_config):
        """A fully clean caste certificate should not be deficient."""
        # Use a recent date within validity window
        recent_date = (datetime.now() - timedelta(days=30)).strftime("%Y-%m-%d")
        doc = TestDocument(
            id=uuid.uuid4(),
            application_id=uuid.uuid4(),
            doc_type="caste_certificate",
            storage_key="test",
            status=DocumentStatus.PENDING,
            extracted_fields={
                "applicant_name": {"value": "Rajesh Kumar", "confidence": "high"},
                "category": {"value": "ST", "confidence": "high"},
                "issuing_authority": {"value": "District Magistrate", "confidence": "medium"},
                "issue_date": {"value": recent_date, "confidence": "medium"},
            }
        )

        result = check_document(doc, scheme_config)

        assert result.is_deficient is False
        assert result.reasons == []

    def test_clean_income_certificate_not_deficient(self, scheme_config):
        """A fully clean income certificate should not be deficient."""
        recent_date = (datetime.now() - timedelta(days=30)).strftime("%Y-%m-%d")
        doc = TestDocument(
            id=uuid.uuid4(),
            application_id=uuid.uuid4(),
            doc_type="income_certificate",
            storage_key="test",
            status=DocumentStatus.PENDING,
            extracted_fields={
                "applicant_name": {"value": "Priya Sharma", "confidence": "high"},
                "annual_income": {"value": "450000", "confidence": "high"},
                "issuing_authority": {"value": "Tehsildar", "confidence": "medium"},
                "issue_date": {"value": recent_date, "confidence": "medium"},
            }
        )

        result = check_document(doc, scheme_config)

        assert result.is_deficient is False
        assert result.reasons == []

    def test_clean_marksheet_not_deficient(self, scheme_config):
        """A fully clean marksheet should not be deficient."""
        doc = TestDocument(
            id=uuid.uuid4(),
            application_id=uuid.uuid4(),
            doc_type="marksheet",
            storage_key="test",
            status=DocumentStatus.PENDING,
            extracted_fields={
                "student_name": {"value": "Amit Kumar", "confidence": "high"},
                "percentage": {"value": "85.5", "confidence": "high"},
                "board_or_university": {"value": "CBSE", "confidence": "medium"},
                "exam_year": {"value": "2023", "confidence": "medium"},
            }
        )

        result = check_document(doc, scheme_config)

        assert result.is_deficient is False
        assert result.reasons == []

    # ===== MISSING_FIELD tests =====

    def test_missing_field_caste_certificate(self, scheme_config):
        """Missing category field should trigger MISSING_FIELD."""
        doc = TestDocument(
            id=uuid.uuid4(),
            application_id=uuid.uuid4(),
            doc_type="caste_certificate",
            storage_key="test",
            status=DocumentStatus.PENDING,
            extracted_fields={
                "applicant_name": {"value": "Rajesh Kumar", "confidence": "high"},
                "issuing_authority": {"value": "District Magistrate", "confidence": "medium"},
                "issue_date": {"value": "2024-03-15", "confidence": "medium"},
            }
        )

        result = check_document(doc, scheme_config)

        assert result.is_deficient is True
        missing_reasons = [r for r in result.reasons if r["code"] == "MISSING_FIELD"]
        assert len(missing_reasons) == 1
        assert missing_reasons[0]["field"] == "category"
        assert "category" in missing_reasons[0]["message"]

    def test_missing_multiple_fields(self, scheme_config):
        """Missing multiple fields should all be reported."""
        doc = TestDocument(
            id=uuid.uuid4(),
            application_id=uuid.uuid4(),
            doc_type="income_certificate",
            storage_key="test",
            status=DocumentStatus.PENDING,
            extracted_fields={
                "applicant_name": {"value": "Priya Sharma", "confidence": "high"},
            }
        )

        result = check_document(doc, scheme_config)

        assert result.is_deficient is True
        missing_reasons = [r for r in result.reasons if r["code"] == "MISSING_FIELD"]
        assert len(missing_reasons) == 3  # annual_income, issuing_authority, issue_date
        missing_fields = {r["field"] for r in missing_reasons}
        assert missing_fields == {"annual_income", "issuing_authority", "issue_date"}

    # ===== FORMAT_INVALID tests =====

    def test_invalid_annual_income_non_numeric(self, scheme_config):
        """Non-numeric annual_income should trigger FORMAT_INVALID."""
        doc = TestDocument(
            id=uuid.uuid4(),
            application_id=uuid.uuid4(),
            doc_type="income_certificate",
            storage_key="test",
            status=DocumentStatus.PENDING,
            extracted_fields={
                "applicant_name": {"value": "Priya Sharma", "confidence": "high"},
                "annual_income": {"value": "not a number", "confidence": "low"},
                "issuing_authority": {"value": "Tehsildar", "confidence": "medium"},
                "issue_date": {"value": "2024-05-20", "confidence": "medium"},
            }
        )

        result = check_document(doc, scheme_config)

        assert result.is_deficient is True
        format_reasons = [r for r in result.reasons if r["code"] == "FORMAT_INVALID"]
        assert len(format_reasons) >= 1
        income_reasons = [r for r in format_reasons if r["field"] == "annual_income"]
        assert len(income_reasons) == 1
        assert "positive number" in income_reasons[0]["message"]

    def test_invalid_annual_income_negative(self, scheme_config):
        """Negative annual_income should trigger FORMAT_INVALID."""
        doc = TestDocument(
            id=uuid.uuid4(),
            application_id=uuid.uuid4(),
            doc_type="income_certificate",
            storage_key="test",
            status=DocumentStatus.PENDING,
            extracted_fields={
                "applicant_name": {"value": "Priya Sharma", "confidence": "high"},
                "annual_income": {"value": "-50000", "confidence": "high"},
                "issuing_authority": {"value": "Tehsildar", "confidence": "medium"},
                "issue_date": {"value": "2024-05-20", "confidence": "medium"},
            }
        )

        result = check_document(doc, scheme_config)

        assert result.is_deficient is True
        format_reasons = [r for r in result.reasons if r["code"] == "FORMAT_INVALID"]
        income_reasons = [r for r in format_reasons if r["field"] == "annual_income"]
        assert len(income_reasons) == 1

    def test_invalid_percentage_out_of_range(self, scheme_config):
        """Percentage > 100 should trigger FORMAT_INVALID."""
        doc = TestDocument(
            id=uuid.uuid4(),
            application_id=uuid.uuid4(),
            doc_type="marksheet",
            storage_key="test",
            status=DocumentStatus.PENDING,
            extracted_fields={
                "student_name": {"value": "Amit Kumar", "confidence": "high"},
                "percentage": {"value": "150", "confidence": "high"},
                "board_or_university": {"value": "CBSE", "confidence": "medium"},
                "exam_year": {"value": "2023", "confidence": "medium"},
            }
        )

        result = check_document(doc, scheme_config)

        assert result.is_deficient is True
        format_reasons = [r for r in result.reasons if r["code"] == "FORMAT_INVALID"]
        pct_reasons = [r for r in format_reasons if r["field"] == "percentage"]
        assert len(pct_reasons) == 1
        assert "between 0 and 100" in pct_reasons[0]["message"]

    def test_invalid_category(self, scheme_config):
        """Invalid category should trigger FORMAT_INVALID."""
        doc = TestDocument(
            id=uuid.uuid4(),
            application_id=uuid.uuid4(),
            doc_type="caste_certificate",
            storage_key="test",
            status=DocumentStatus.PENDING,
            extracted_fields={
                "applicant_name": {"value": "Rajesh Kumar", "confidence": "high"},
                "category": {"value": "INVALID", "confidence": "high"},
                "issuing_authority": {"value": "District Magistrate", "confidence": "medium"},
                "issue_date": {"value": "2024-03-15", "confidence": "medium"},
            }
        )

        result = check_document(doc, scheme_config)

        assert result.is_deficient is True
        format_reasons = [r for r in result.reasons if r["code"] == "FORMAT_INVALID"]
        cat_reasons = [r for r in format_reasons if r["field"] == "category"]
        assert len(cat_reasons) == 1
        assert "SC" in cat_reasons[0]["message"] or "ST" in cat_reasons[0]["message"]

    def test_invalid_date_format(self, scheme_config):
        """Invalid date format should trigger FORMAT_INVALID."""
        doc = TestDocument(
            id=uuid.uuid4(),
            application_id=uuid.uuid4(),
            doc_type="caste_certificate",
            storage_key="test",
            status=DocumentStatus.PENDING,
            extracted_fields={
                "applicant_name": {"value": "Rajesh Kumar", "confidence": "high"},
                "category": {"value": "ST", "confidence": "high"},
                "issuing_authority": {"value": "District Magistrate", "confidence": "medium"},
                "issue_date": {"value": "not-a-date", "confidence": "low"},
            }
        )

        result = check_document(doc, scheme_config)

        assert result.is_deficient is True
        format_reasons = [r for r in result.reasons if r["code"] == "FORMAT_INVALID"]
        date_reasons = [r for r in format_reasons if r["field"] == "issue_date"]
        assert len(date_reasons) == 1
        assert "valid date" in date_reasons[0]["message"]

    def test_invalid_passport_number(self, scheme_config):
        """Invalid passport number format should trigger FORMAT_INVALID."""
        doc = TestDocument(
            id=uuid.uuid4(),
            application_id=uuid.uuid4(),
            doc_type="passport",
            storage_key="test",
            status=DocumentStatus.PENDING,
            extracted_fields={
                "full_name": {"value": "Amit Singh", "confidence": "high"},
                "passport_number": {"value": "12345678", "confidence": "high"},
                "date_of_birth": {"value": "1990-08-15", "confidence": "high"},
                "expiry_date": {"value": "2030-05-10", "confidence": "high"},
            }
        )

        result = check_document(doc, scheme_config)

        assert result.is_deficient is True
        format_reasons = [r for r in result.reasons if r["code"] == "FORMAT_INVALID"]
        passport_reasons = [r for r in format_reasons if r["field"] == "passport_number"]
        assert len(passport_reasons) == 1
        assert "1 letter followed by 7 digits" in passport_reasons[0]["message"]

    # ===== EXPIRED_DATE tests =====

    def test_expired_caste_certificate(self, scheme_config):
        """Old issue_date should trigger EXPIRED_DATE for caste certificate."""
        old_date = (datetime.now() - timedelta(days=400)).strftime("%Y-%m-%d")
        doc = TestDocument(
            id=uuid.uuid4(),
            application_id=uuid.uuid4(),
            doc_type="caste_certificate",
            storage_key="test",
            status=DocumentStatus.PENDING,
            extracted_fields={
                "applicant_name": {"value": "Rajesh Kumar", "confidence": "high"},
                "category": {"value": "ST", "confidence": "high"},
                "issuing_authority": {"value": "District Magistrate", "confidence": "medium"},
                "issue_date": {"value": old_date, "confidence": "medium"},
            }
        )

        result = check_document(doc, scheme_config)

        assert result.is_deficient is True
        expired_reasons = [r for r in result.reasons if r["code"] == "EXPIRED_DATE"]
        assert len(expired_reasons) == 1
        assert expired_reasons[0]["field"] == "issue_date"
        assert "expired" in expired_reasons[0]["message"].lower()

    def test_not_expired_caste_certificate(self, scheme_config):
        """Recent issue_date should not trigger EXPIRED_DATE."""
        recent_date = (datetime.now() - timedelta(days=30)).strftime("%Y-%m-%d")
        doc = TestDocument(
            id=uuid.uuid4(),
            application_id=uuid.uuid4(),
            doc_type="caste_certificate",
            storage_key="test",
            status=DocumentStatus.PENDING,
            extracted_fields={
                "applicant_name": {"value": "Rajesh Kumar", "confidence": "high"},
                "category": {"value": "ST", "confidence": "high"},
                "issuing_authority": {"value": "District Magistrate", "confidence": "medium"},
                "issue_date": {"value": recent_date, "confidence": "medium"},
            }
        )

        result = check_document(doc, scheme_config)

        expired_reasons = [r for r in result.reasons if r["code"] == "EXPIRED_DATE"]
        assert len(expired_reasons) == 0

    def test_expired_date_not_applicable_for_marksheet(self, scheme_config):
        """EXPIRED_DATE should not apply to marksheet."""
        old_date = (datetime.now() - timedelta(days=400)).strftime("%Y-%m-%d")
        doc = TestDocument(
            id=uuid.uuid4(),
            application_id=uuid.uuid4(),
            doc_type="marksheet",
            storage_key="test",
            status=DocumentStatus.PENDING,
            extracted_fields={
                "student_name": {"value": "Amit Kumar", "confidence": "high"},
                "percentage": {"value": "85.5", "confidence": "high"},
                "board_or_university": {"value": "CBSE", "confidence": "medium"},
                "exam_year": {"value": "2020", "confidence": "medium"},
            }
        )

        result = check_document(doc, scheme_config)

        expired_reasons = [r for r in result.reasons if r["code"] == "EXPIRED_DATE"]
        assert len(expired_reasons) == 0

    def test_custom_validity_days_override(self, scheme_config):
        """Custom validity_days from scheme config should be used."""
        # Add validity_days to the config
        config_dict = scheme_config.model_dump()
        for rd in config_dict["required_documents"]:
            if rd["doc_type"] == "caste_certificate":
                rd["validity_days"] = 100
                break
        custom_config = validate_scheme_config(config_dict)

        # Date that's > 100 days old but < 365 days old
        old_date = (datetime.now() - timedelta(days=200)).strftime("%Y-%m-%d")
        doc = TestDocument(
            id=uuid.uuid4(),
            application_id=uuid.uuid4(),
            doc_type="caste_certificate",
            storage_key="test",
            status=DocumentStatus.PENDING,
            extracted_fields={
                "applicant_name": {"value": "Rajesh Kumar", "confidence": "high"},
                "category": {"value": "ST", "confidence": "high"},
                "issuing_authority": {"value": "District Magistrate", "confidence": "medium"},
                "issue_date": {"value": old_date, "confidence": "medium"},
            }
        )

        result = check_document(doc, custom_config)

        assert result.is_deficient is True
        expired_reasons = [r for r in result.reasons if r["code"] == "EXPIRED_DATE"]
        assert len(expired_reasons) == 1
        assert "100" in expired_reasons[0]["message"]

    # ===== DOC_TYPE_MISMATCH tests =====

    def test_doc_type_mismatch_near_empty_fields(self, scheme_config):
        """Substantial OCR text but very few fields should trigger DOC_TYPE_MISMATCH."""
        doc = TestDocument(
            id=uuid.uuid4(),
            application_id=uuid.uuid4(),
            doc_type="caste_certificate",
            storage_key="test",
            status=DocumentStatus.PENDING,
            extracted_fields={
                "_raw_text": "This is a long OCR text that was extracted from the document but it doesn't match the expected caste certificate format at all. It might be a completely different document type that was uploaded by mistake.",
                "applicant_name": {"value": "Some Name", "confidence": "low"},
            }
        )

        result = check_document(doc, scheme_config)

        assert result.is_deficient is True
        mismatch_reasons = [r for r in result.reasons if r["code"] == "DOC_TYPE_MISMATCH"]
        assert len(mismatch_reasons) == 1
        assert mismatch_reasons[0]["field"] is None
        assert "wrong document type" in mismatch_reasons[0]["message"].lower()

    def test_no_doc_type_mismatch_when_few_fields_expected(self, scheme_config):
        """If only a few fields are expected, don't flag mismatch."""
        # For a doc_type with only 1-2 expected fields, having 1 field is normal
        # This test ensures the threshold logic works correctly
        doc = TestDocument(
            id=uuid.uuid4(),
            application_id=uuid.uuid4(),
            doc_type="caste_certificate",
            storage_key="test",
            status=DocumentStatus.PENDING,
            extracted_fields={
                "_raw_text": "Short text",
                "applicant_name": {"value": "Some Name", "confidence": "high"},
                "category": {"value": "ST", "confidence": "high"},
            }
        )

        result = check_document(doc, scheme_config)

        mismatch_reasons = [r for r in result.reasons if r["code"] == "DOC_TYPE_MISMATCH"]
        assert len(mismatch_reasons) == 0

    # ===== LOW_CONFIDENCE_FIELD tests =====

    def test_low_confidence_field_flagged(self, scheme_config):
        """Low confidence field should trigger LOW_CONFIDENCE_FIELD."""
        doc = TestDocument(
            id=uuid.uuid4(),
            application_id=uuid.uuid4(),
            doc_type="caste_certificate",
            storage_key="test",
            status=DocumentStatus.PENDING,
            extracted_fields={
                "applicant_name": {"value": "Rajesh Kumar", "confidence": "high"},
                "category": {"value": "ST", "confidence": "high"},
                "issuing_authority": {"value": "District Magistrate", "confidence": "low"},
                "issue_date": {"value": "2024-03-15", "confidence": "medium"},
            }
        )

        result = check_document(doc, scheme_config)

        # Document should not be deficient just due to low confidence
        # LOW_CONFIDENCE_FIELD is a soft flag
        low_conf_reasons = [r for r in result.reasons if r["code"] == "LOW_CONFIDENCE_FIELD"]
        assert len(low_conf_reasons) == 1
        assert low_conf_reasons[0]["field"] == "issuing_authority"

    def test_low_confidence_with_other_errors_makes_deficient(self, scheme_config):
        """Low confidence + other errors should make document deficient."""
        doc = TestDocument(
            id=uuid.uuid4(),
            application_id=uuid.uuid4(),
            doc_type="caste_certificate",
            storage_key="test",
            status=DocumentStatus.PENDING,
            extracted_fields={
                "applicant_name": {"value": "Rajesh Kumar", "confidence": "high"},
                "category": {"value": "ST", "confidence": "high"},
                "issuing_authority": {"value": "District Magistrate", "confidence": "low"},
                # Missing issue_date
            }
        )

        result = check_document(doc, scheme_config)

        assert result.is_deficient is True
        missing_reasons = [r for r in result.reasons if r["code"] == "MISSING_FIELD"]
        low_conf_reasons = [r for r in result.reasons if r["code"] == "LOW_CONFIDENCE_FIELD"]
        assert len(missing_reasons) == 1
        assert len(low_conf_reasons) == 1


class TestApplicationLevelDeficiency:
    """Integration tests for application-level deficiency checking."""

    @pytest.fixture
    def nfst_config(self) -> dict:
        return load_fixture("nfst_config.json")

    def test_all_verified_transitions_to_selection(self, db, nfst_config):
        """All documents VERIFIED -> transition to selection (documents_verified)."""
        scheme = _create_test_scheme(db, "NFST", nfst_config)
        application = _create_test_application(db, scheme, nfst_config)

        # Create clean documents for all required types
        recent_date = (datetime.now() - timedelta(days=30)).strftime("%Y-%m-%d")
        doc_types = ["caste_certificate", "income_certificate", "marksheet", "bonafide_certificate"]
        for dt in doc_types:
            if dt == "caste_certificate":
                fields = {
                    "applicant_name": {"value": "Test", "confidence": "high"},
                    "category": {"value": "ST", "confidence": "high"},
                    "issuing_authority": {"value": "Auth", "confidence": "medium"},
                    "issue_date": {"value": recent_date, "confidence": "medium"},
                }
            elif dt == "income_certificate":
                fields = {
                    "applicant_name": {"value": "Test", "confidence": "high"},
                    "annual_income": {"value": "300000", "confidence": "high"},
                    "issuing_authority": {"value": "Auth", "confidence": "medium"},
                    "issue_date": {"value": recent_date, "confidence": "medium"},
                }
            elif dt == "marksheet":
                fields = {
                    "student_name": {"value": "Test", "confidence": "high"},
                    "percentage": {"value": "85.5", "confidence": "high"},
                    "board_or_university": {"value": "CBSE", "confidence": "medium"},
                    "exam_year": {"value": "2023", "confidence": "medium"},
                }
            else:  # bonafide_certificate
                fields = {
                    "student_name": {"value": "Test", "confidence": "high"},
                    "institution_name": {"value": "Univ", "confidence": "high"},
                    "course": {"value": "PhD", "confidence": "medium"},
                    "academic_year": {"value": "2023-2024", "confidence": "medium"},
                }
            _create_test_document(db, application, dt, fields)

        # Move to document_scrutiny state
        application.current_state = "document_scrutiny"
        db.commit()

        # Run scrutiny
        from app.services.workflow_engine import WorkflowEngine
        engine = WorkflowEngine(db)
        updated_app = engine.run_document_scrutiny(application)

        assert updated_app.current_state == "selection"

    def test_any_deficient_transitions_to_deficient(self, db, nfst_config):
        """Any deficient document -> transition to deficient (documents_flagged_deficient)."""
        scheme = _create_test_scheme(db, "NFST", nfst_config)
        application = _create_test_application(db, scheme, nfst_config)

        # One good document
        recent_date = (datetime.now() - timedelta(days=30)).strftime("%Y-%m-%d")
        _create_test_document(db, application, "caste_certificate", {
            "applicant_name": {"value": "Test", "confidence": "high"},
            "category": {"value": "ST", "confidence": "high"},
            "issuing_authority": {"value": "Auth", "confidence": "medium"},
            "issue_date": {"value": recent_date, "confidence": "medium"},
        })

        # One deficient document (missing annual_income)
        _create_test_document(db, application, "income_certificate", {
            "applicant_name": {"value": "Test", "confidence": "high"},
            "annual_income": {"value": "300000", "confidence": "high"},
            "issuing_authority": {"value": "Auth", "confidence": "medium"},
            "issue_date": {"value": recent_date, "confidence": "medium"},
        })
        # Note: income_certificate needs category? No, it doesn't. Let's make it missing annual_income
        # Actually let's add a document with missing field

        # Update the income_certificate to be deficient
        docs = db.query(TestDocument).filter(TestDocument.application_id == application.id).all()
        income_doc = [d for d in docs if d.doc_type == "income_certificate"][0]
        income_doc.extracted_fields = {
            "applicant_name": {"value": "Test", "confidence": "high"},
            "issuing_authority": {"value": "Auth", "confidence": "medium"},
            "issue_date": {"value": recent_date, "confidence": "medium"},
        }
        db.commit()

        # Add remaining required docs
        for dt in ["marksheet", "bonafide_certificate"]:
            if dt == "marksheet":
                fields = {
                    "student_name": {"value": "Test", "confidence": "high"},
                    "percentage": {"value": "85.5", "confidence": "high"},
                    "board_or_university": {"value": "CBSE", "confidence": "medium"},
                    "exam_year": {"value": "2023", "confidence": "medium"},
                }
            else:
                fields = {
                    "student_name": {"value": "Test", "confidence": "high"},
                    "institution_name": {"value": "Univ", "confidence": "high"},
                    "course": {"value": "PhD", "confidence": "medium"},
                    "academic_year": {"value": "2023-2024", "confidence": "medium"},
                }
            _create_test_document(db, application, dt, fields)

        application.current_state = "document_scrutiny"
        db.commit()

        from app.services.workflow_engine import WorkflowEngine
        engine = WorkflowEngine(db)
        updated_app = engine.run_document_scrutiny(application)

        assert updated_app.current_state == "deficient"

        # Check audit log has deficiency summary
        audit_logs = db.query(TestAuditLog).filter(
            TestAuditLog.application_id == application.id
        ).all()
        transition_log = [l for l in audit_logs if l.action == "state_transition" and l.to_state == "deficient"]
        assert len(transition_log) == 1
        assert "deficiency_summary" in transition_log[0].details

    def test_missing_required_document_transitions_to_deficient(self, db, nfst_config):
        """Missing required document -> transition to deficient."""
        scheme = _create_test_scheme(db, "NFST", nfst_config)
        application = _create_test_application(db, scheme, nfst_config)

        # Only upload 3 of 4 required documents
        recent_date = (datetime.now() - timedelta(days=30)).strftime("%Y-%m-%d")
        for dt in ["caste_certificate", "income_certificate", "marksheet"]:
            if dt == "caste_certificate":
                fields = {
                    "applicant_name": {"value": "Test", "confidence": "high"},
                    "category": {"value": "ST", "confidence": "high"},
                    "issuing_authority": {"value": "Auth", "confidence": "medium"},
                    "issue_date": {"value": recent_date, "confidence": "medium"},
                }
            elif dt == "income_certificate":
                fields = {
                    "applicant_name": {"value": "Test", "confidence": "high"},
                    "annual_income": {"value": "300000", "confidence": "high"},
                    "issuing_authority": {"value": "Auth", "confidence": "medium"},
                    "issue_date": {"value": recent_date, "confidence": "medium"},
                }
            else:
                fields = {
                    "student_name": {"value": "Test", "confidence": "high"},
                    "percentage": {"value": "85.5", "confidence": "high"},
                    "board_or_university": {"value": "CBSE", "confidence": "medium"},
                    "exam_year": {"value": "2023", "confidence": "medium"},
                }
            _create_test_document(db, application, dt, fields)

        application.current_state = "document_scrutiny"
        db.commit()

        from app.services.workflow_engine import WorkflowEngine
        engine = WorkflowEngine(db)
        updated_app = engine.run_document_scrutiny(application)

        assert updated_app.current_state == "deficient"

        # Check audit log has missing_documents
        audit_logs = db.query(TestAuditLog).filter(
            TestAuditLog.application_id == application.id
        ).all()
        transition_log = [l for l in audit_logs if l.action == "state_transition" and l.to_state == "deficient"]
        assert len(transition_log) == 1
        assert "bonafide_certificate" in transition_log[0].details.get("missing_documents", [])


class TestResubmissionCycle:
    """Integration tests for the resubmission flow."""

    @pytest.fixture
    def nfst_config(self) -> dict:
        return load_fixture("nfst_config.json")

    def test_resubmission_cycle(self, db, nfst_config):
        """
        Full resubmission cycle test:
        1. Application in deficient state
        2. Resubmit bad document with clean data
        3. All documents now VERIFIED
        4. Auto-transition via 'resubmitted' trigger
        """
        scheme = _create_test_scheme(db, "NFST", nfst_config)
        application = _create_test_application(db, scheme, nfst_config)

        recent_date = (datetime.now() - timedelta(days=30)).strftime("%Y-%m-%d")

        # Create documents - one deficient (income_certificate missing annual_income)
        caste_doc = _create_test_document(db, application, "caste_certificate", {
            "applicant_name": {"value": "Test", "confidence": "high"},
            "category": {"value": "ST", "confidence": "high"},
            "issuing_authority": {"value": "Auth", "confidence": "medium"},
            "issue_date": {"value": recent_date, "confidence": "medium"},
        })

        income_doc = _create_test_document(db, application, "income_certificate", {
            "applicant_name": {"value": "Test", "confidence": "high"},
            "issuing_authority": {"value": "Auth", "confidence": "medium"},
            "issue_date": {"value": recent_date, "confidence": "medium"},
        })

        for dt in ["marksheet", "bonafide_certificate"]:
            if dt == "marksheet":
                fields = {
                    "student_name": {"value": "Test", "confidence": "high"},
                    "percentage": {"value": "85.5", "confidence": "high"},
                    "board_or_university": {"value": "CBSE", "confidence": "medium"},
                    "exam_year": {"value": "2023", "confidence": "medium"},
                }
            else:
                fields = {
                    "student_name": {"value": "Test", "confidence": "high"},
                    "institution_name": {"value": "Univ", "confidence": "high"},
                    "course": {"value": "PhD", "confidence": "medium"},
                    "academic_year": {"value": "2023-2024", "confidence": "medium"},
                }
            _create_test_document(db, application, dt, fields)

        # Run scrutiny to get to deficient state
        application.current_state = "document_scrutiny"
        db.commit()

        from app.services.workflow_engine import WorkflowEngine
        from app.services.deficiency_service import check_document
        config = validate_scheme_config(nfst_config)
        engine = WorkflowEngine(db)
        engine.run_document_scrutiny(application)

        assert application.current_state == "deficient"

        # Update document statuses based on deficiency checks after initial scrutiny
        all_docs = db.query(TestDocument).filter(TestDocument.application_id == application.id).all()
        for doc in all_docs:
            check = check_document(doc, config)
            doc.deficiency_reasons = check.reasons
            doc.status = DocumentStatus.VERIFIED if not check.is_deficient else DocumentStatus.DEFICIENT
        db.commit()

        # Now resubmit the income_certificate with clean data
        # Simulate by directly updating the document and re-running check
        income_doc.extracted_fields = {
            "applicant_name": {"value": "Test", "confidence": "high"},
            "annual_income": {"value": "300000", "confidence": "high"},
            "issuing_authority": {"value": "Auth", "confidence": "medium"},
            "issue_date": {"value": recent_date, "confidence": "medium"},
        }
        income_doc.status = DocumentStatus.PENDING
        db.commit()

        # Re-run deficiency check on the resubmitted document
        check = check_document(income_doc, config)
        income_doc.deficiency_reasons = check.reasons
        income_doc.status = DocumentStatus.VERIFIED if not check.is_deficient else DocumentStatus.DEFICIENT
        db.commit()

        # Verify all documents are now VERIFIED
        all_docs = db.query(TestDocument).filter(TestDocument.application_id == application.id).all()
        all_verified = all(doc.status == DocumentStatus.VERIFIED for doc in all_docs)
        assert all_verified is True

        # Apply resubmitted transition
        updated_app = engine.apply_transition(
            application=application,
            trigger="resubmitted",
            actor_user_id=None,
            details={"resubmitted_document_id": str(income_doc.id)}
        )

        assert updated_app.current_state == "document_scrutiny"

    def test_run_document_scrutiny_from_wrong_state_raises_error(self, db, nfst_config):
        """run_document_scrutiny should raise error if called from invalid state."""
        scheme = _create_test_scheme(db, "NFST", nfst_config)
        application = _create_test_application(db, scheme, nfst_config)

        # Application is in 'submitted' state, not 'document_scrutiny'
        from app.services.workflow_engine import WorkflowEngine, InvalidTransitionError
        engine = WorkflowEngine(db)

        with pytest.raises(InvalidTransitionError):
            engine.run_document_scrutiny(application)


class TestCheckApplicationDocuments:
    """Tests for check_application_documents function."""

    @pytest.fixture
    def nfst_config(self) -> dict:
        return load_fixture("nfst_config.json")

    @pytest.fixture
    def scheme_config(self, nfst_config) -> SchemeConfig:
        return validate_scheme_config(nfst_config)

    def test_check_application_documents_returns_dict(self, db, nfst_config, scheme_config):
        """check_application_documents returns dict mapping doc_id -> DeficiencyCheck."""
        scheme = _create_test_scheme(db, "NFST", nfst_config)
        application = _create_test_application(db, scheme, nfst_config)

        recent_date = (datetime.now() - timedelta(days=30)).strftime("%Y-%m-%d")

        # Create one clean, one deficient document
        clean_doc = _create_test_document(db, application, "caste_certificate", {
            "applicant_name": {"value": "Test", "confidence": "high"},
            "category": {"value": "ST", "confidence": "high"},
            "issuing_authority": {"value": "Auth", "confidence": "medium"},
            "issue_date": {"value": recent_date, "confidence": "medium"},
        })

        deficient_doc = _create_test_document(db, application, "income_certificate", {
            "applicant_name": {"value": "Test", "confidence": "high"},
            # Missing annual_income
            "issuing_authority": {"value": "Auth", "confidence": "medium"},
            "issue_date": {"value": recent_date, "confidence": "medium"},
        })

        results = check_application_documents(application, scheme_config, db)

        assert len(results) == 2
        assert str(clean_doc.id) in results
        assert str(deficient_doc.id) in results

        assert results[str(clean_doc.id)].is_deficient is False
        assert results[str(deficient_doc.id)].is_deficient is True