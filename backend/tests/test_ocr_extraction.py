"""
Tests for OCR and field extraction services.
"""

import io
import json
import uuid
from datetime import datetime
from pathlib import Path
from typing import Any, Dict, List, Optional

import pytest
from fastapi.testclient import TestClient
from sqlalchemy import create_engine, JSON, String, Text, DateTime, func, ForeignKey, Boolean
from sqlalchemy.dialects.postgresql import UUID as PG_UUID
from sqlalchemy.orm import sessionmaker, DeclarativeBase, Mapped, mapped_column, relationship

from app.main import app
from app.core.database import get_db
from app.core.security import create_access_token, hash_password
from app.models.user import UserRole


# Test-specific models using SQLite-compatible types (JSON instead of JSONB)
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


def _create_test_user(db, email: str, role: UserRole, password: str = "Test@123") -> "TestUser":
    """Helper to create a test user."""
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


def _get_token(user) -> str:
    """Generate a JWT token for a user."""
    return create_access_token(user_id=user.id, role=user.role)


def _create_test_scheme(db, code: str, config_data: dict) -> "TestScheme":
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


def _create_test_application(db, scheme: "TestScheme", config_data: dict) -> "TestApplication":
    """Helper to create a test application."""
    from app.services.scheme_config_validator import validate_scheme_config
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


class TestFieldExtractionService:
    """Unit tests for field extraction service using hand-written sample text."""

    def test_extract_caste_certificate(self):
        """Test extraction from caste certificate text."""
        from app.services.field_extraction_service import extract_fields

        text = """
        GOVERNMENT OF INDIA
        CASTE CERTIFICATE
        Name: Rajesh Kumar
        Category: ST
        Issuing Authority: District Magistrate, Ranchi
        Date: 15/03/2024
        """
        fields = extract_fields(text, "caste_certificate")
        assert "applicant_name" in fields
        assert fields["applicant_name"]["value"] == "Rajesh Kumar"
        assert fields["category"]["value"] == "ST"
        assert "issuing_authority" in fields
        assert "issue_date" in fields
        assert fields["issue_date"]["value"] == "2024-03-15"

    def test_extract_income_certificate(self):
        """Test extraction from income certificate text."""
        from app.services.field_extraction_service import extract_fields

        text = """
        INCOME CERTIFICATE
        Name: Priya Sharma
        Annual Income: Rs. 4,50,000
        Issuing Authority: Tehsildar, Patna
        Date: 20/05/2024
        """
        fields = extract_fields(text, "income_certificate")
        assert "applicant_name" in fields
        assert fields["applicant_name"]["value"] == "Priya Sharma"
        assert "annual_income" in fields
        assert fields["annual_income"]["value"] == "450000"
        assert "issuing_authority" in fields
        assert "issue_date" in fields
        assert fields["issue_date"]["value"] == "2024-05-20"

    def test_extract_marksheet(self):
        """Test extraction from marksheet text."""
        from app.services.field_extraction_service import extract_fields

        text = """
        MARKSHEET
        Student Name: Amit Kumar
        Percentage: 85.5%
        Board: CBSE
        Exam Year: 2023
        """
        fields = extract_fields(text, "marksheet")
        assert "student_name" in fields
        assert fields["student_name"]["value"] == "Amit Kumar"
        assert "percentage" in fields
        assert fields["percentage"]["value"] == "85.5"
        assert "board_or_university" in fields
        assert fields["board_or_university"]["value"] == "CBSE"
        assert "exam_year" in fields
        assert fields["exam_year"]["value"] == "2023"

    def test_extract_bonafide_certificate(self):
        """Test extraction from bonafide certificate text."""
        from app.services.field_extraction_service import extract_fields

        text = """
        BONAFIDE CERTIFICATE
        Student Name: Sunita Devi
        Institution: Ranchi University
        Course: PhD Computer Science
        Academic Year: 2023-2024
        """
        fields = extract_fields(text, "bonafide_certificate")
        assert "student_name" in fields
        assert fields["student_name"]["value"] == "Sunita Devi"
        assert "institution_name" in fields
        assert "course" in fields
        assert fields["course"]["value"] == "PhD Computer Science"
        assert "academic_year" in fields
        assert fields["academic_year"]["value"] == "2023-2024"

    def test_extract_passport(self):
        """Test extraction from passport text."""
        from app.services.field_extraction_service import extract_fields

        text = """
        PASSPORT
        Name: Amit Singh
        Passport Number: Z1234567
        Date of Birth: 15/08/1990
        Expiry Date: 10/05/2030
        """
        fields = extract_fields(text, "passport")
        assert "full_name" in fields
        assert fields["full_name"]["value"] == "Amit Singh"
        assert "passport_number" in fields
        assert fields["passport_number"]["value"] == "Z1234567"
        assert "date_of_birth" in fields
        assert fields["date_of_birth"]["value"] == "1990-08-15"
        assert "expiry_date" in fields

    def test_extract_admission_letter(self):
        """Test extraction from admission letter text."""
        from app.services.field_extraction_service import extract_fields

        text = """
        ADMISSION LETTER
        Name: Ravi Kumar
        University: Harvard University
        Program: PhD Computer Science
        Admission Date: 01/09/2024
        """
        fields = extract_fields(text, "admission_letter")
        assert "applicant_name" in fields
        assert fields["applicant_name"]["value"] == "Ravi Kumar"
        assert "institution_name" in fields
        assert "program" in fields
        assert fields["program"]["value"] == "PhD Computer Science"
        assert "admission_date" in fields
        assert fields["admission_date"]["value"] == "2024-09-01"

    def test_extract_degree_transcript(self):
        """Test extraction from degree transcript text."""
        from app.services.field_extraction_service import extract_fields

        text = """
        DEGREE TRANSCRIPT
        Student Name: Priya Patel
        Percentage: 78.3%
        University: Delhi University
        Graduation Year: 2022
        """
        fields = extract_fields(text, "degree_transcript")
        assert "student_name" in fields
        assert fields["student_name"]["value"] == "Priya Patel"
        assert "percentage" in fields
        assert fields["percentage"]["value"] == "78.3"
        assert "university" in fields
        assert "graduation_year" in fields
        assert fields["graduation_year"]["value"] == "2022"

    def test_extract_ielts_toefl_scorecard(self):
        """Test extraction from IELTS/TOEFL scorecard text."""
        from app.services.field_extraction_service import extract_fields

        text = """
        IELTS SCORECARD
        Overall Band: 7.5
        Listening: 8.0
        Reading: 7.0
        Writing: 7.5
        Speaking: 7.0
        Test Date: 15/03/2024
        """
        fields = extract_fields(text, "ielts_toefl_scorecard")
        assert "test_type" in fields
        assert fields["test_type"]["value"] == "IELTS"
        assert "overall_score" in fields
        assert fields["overall_score"]["value"] == "7.5"
        assert "band_scores" in fields
        assert "test_date" in fields
        assert fields["test_date"]["value"] == "2024-03-15"

    def test_unknown_doc_type_returns_empty(self):
        """Test that unknown doc_type returns empty dict."""
        from app.services.field_extraction_service import extract_fields

        fields = extract_fields("some text", "unknown_type")
        assert fields == {}

    def test_empty_text_returns_empty(self):
        """Test that empty text returns empty dict."""
        from app.services.field_extraction_service import extract_fields

        fields = extract_fields("", "caste_certificate")
        assert fields == {}
        fields = extract_fields("   ", "income_certificate")
        assert fields == {}


class TestOCRService:
    """Tests for OCR service (mocked since we don't have tesseract in test env)."""

    def test_extract_text_returns_string(self):
        """Test that extract_text returns a string."""
        from app.services.ocr_service import extract_text
        from unittest.mock import patch, MagicMock

        with patch("app.services.ocr_service.subprocess.run") as mock_run:
            mock_run.return_value = MagicMock(stdout="Sample text", stderr="", returncode=0)
            result = extract_text(b"fake image bytes", "image/png")
            assert isinstance(result, str)
            assert result == "Sample text"

    def test_extract_text_empty_bytes_returns_empty(self):
        """Test that empty bytes returns empty string."""
        from app.services.ocr_service import extract_text
        result = extract_text(b"", "image/png")
        assert result == ""

    def test_extract_text_unsupported_type_returns_empty(self):
        """Test that unsupported content type returns empty string."""
        from app.services.ocr_service import extract_text
        result = extract_text(b"some bytes", "application/msword")
        assert result == ""


class TestDocumentProcessingIntegration:
    """Integration tests for document processing pipeline."""

    @pytest.fixture
    def db(self):
        """Create a fresh database session for each test."""
        TestBase.metadata.create_all(bind=engine)
        db = TestingSessionLocal()
        try:
            yield db
        finally:
            db.close()
            TestBase.metadata.drop_all(bind=engine)

    @pytest.fixture
    def super_admin(self, db):
        return _create_test_user(db, "super@test.com", UserRole.SUPER_ADMIN)

    @pytest.fixture
    def super_admin_client(self, super_admin, db):
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
    def nfst_scheme(self, db):
        return _create_test_scheme(db, "NFST", load_fixture("nfst_config.json"))

    @pytest.fixture
    def application(self, db, nfst_scheme):
        return _create_test_application(db, nfst_scheme, load_fixture("nfst_config.json"))

    def test_upload_triggers_processing(self, super_admin_client, application, db):
        """Test that upload triggers OCR processing."""
        from unittest.mock import patch, MagicMock

        # Mock storage service (the singleton used in api/documents.py and document_processing_service.py)
        with patch("app.api.documents.storage_service") as mock_storage:
            mock_storage.upload_file = MagicMock()
            mock_storage.get_presigned_url = MagicMock(return_value="http://minio:9000/presigned")
            mock_storage.generate_storage_key = MagicMock(return_value="app-id/caste_certificate/uuid.pdf")
            mock_storage.download_file = MagicMock(return_value=b"fake pdf content")

            # Also mock the storage_service in document_processing_service module
            with patch("app.services.document_processing_service.storage_service", mock_storage):
                # Mock OCR and field extraction
                with patch("app.services.document_processing_service.extract_text", return_value="Name: Test User\nCategory: ST\nDate: 15/03/2024"):
                    with patch("app.services.document_processing_service.extract_fields", return_value={
                        "applicant_name": {"value": "Test User", "confidence": "high"},
                        "category": {"value": "ST", "confidence": "high"},
                        "issue_date": {"value": "2024-03-15", "confidence": "medium"}
                    }):
                        from app.services.document_processing_service import process_document

                        file_content = b"fake pdf content"
                        files = {"file": ("test.pdf", io.BytesIO(file_content), "application/pdf")}
                        data = {"doc_type": "caste_certificate"}

                        res = super_admin_client.post(
                            f"/api/applications/{application.id}/documents",
                            files=files,
                            data=data,
                        )

                        assert res.status_code == 201
                        body = res.json()
                        assert body["extracted_fields"] is not None
                        assert "applicant_name" in body["extracted_fields"]
                        assert body["extracted_fields"]["applicant_name"]["value"] == "Test User"

    def test_reprocess_endpoint(self, super_admin_client, application, db):
        """Test the reprocess endpoint."""
        from unittest.mock import patch, MagicMock

        # Create a document
        doc = TestDocument(
            application_id=application.id,
            doc_type="caste_certificate",
            storage_key="app-id/caste_certificate/uuid.pdf",
            status="PENDING",
            content_type="application/pdf",
        )
        db.add(doc)
        db.commit()
        db.refresh(doc)

        # Mock storage service (the singleton used in document_processing_service.py and api/documents.py)
        with patch("app.services.document_processing_service.storage_service") as mock_storage:
            mock_storage.get_presigned_url = MagicMock(return_value="http://minio:9000/presigned")
            mock_storage.download_file = MagicMock(return_value=b"fake pdf content")

            # Mock OCR and field extraction
            with patch("app.services.document_processing_service.extract_text", return_value="Name: Reprocessed User\nCategory: ST\nDate: 20/04/2024"):
                with patch("app.services.document_processing_service.extract_fields", return_value={
                    "applicant_name": {"value": "Reprocessed User", "confidence": "high"},
                    "category": {"value": "ST", "confidence": "high"},
                }):
                    res = super_admin_client.post(f"/api/applications/documents/{doc.id}/reprocess")
                    assert res.status_code == 200
                    body = res.json()
                    assert "applicant_name" in body["extracted_fields"]
                    assert body["extracted_fields"]["applicant_name"]["value"] == "Reprocessed User"

    def test_process_document_directly(self, db, application):
        """Test process_document function directly."""
        from app.services.document_processing_service import process_document
        from unittest.mock import patch, MagicMock

        doc = TestDocument(
            application_id=application.id,
            doc_type="income_certificate",
            storage_key="app-id/income_certificate/uuid.pdf",
            status="PENDING",
            content_type="application/pdf",
        )
        db.add(doc)
        db.commit()
        db.refresh(doc)

        with patch("app.services.document_processing_service.storage_service") as mock_storage:
            mock_storage.download_file = MagicMock(return_value=b"fake pdf bytes")

            with patch("app.services.document_processing_service.extract_text", return_value="Name: Direct User\nAnnual Income: Rs. 5,00,000\nDate: 01/01/2024"):
                with patch("app.services.document_processing_service.extract_fields", return_value={
                    "applicant_name": {"value": "Direct User", "confidence": "high"},
                    "annual_income": {"value": "500000", "confidence": "high"},
                }):
                    result = process_document(db, doc.id)
                    assert "extracted_fields" in result
                    assert result["extracted_fields"]["applicant_name"]["value"] == "Direct User"

        # Clean Up
        db.delete(doc)
        db.commit()