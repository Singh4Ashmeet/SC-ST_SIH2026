"""
Tests for Documents API: upload, list, retrieve, delete with storage mocking.
"""

import io
import json
import uuid
from datetime import datetime
from pathlib import Path
from typing import Any, Dict, List, Optional
from unittest.mock import AsyncMock, MagicMock, patch

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

    @property
    def value(self) -> str:
        return self.role

    @property
    def role_enum(self) -> UserRole:
        return UserRole(self.role)


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


class TestDocument(TestBase, TestBaseModelMixin):
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


# Test database setup
TEST_DB_URL = "sqlite:///./test_documents.db"
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


def _create_test_user(db, email: str, role: UserRole, password: str = "Test@123") -> TestUser:
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


def _get_token(user: TestUser) -> str:
    """Generate a JWT token for a user."""
    return create_access_token(user_id=user.id, role=user.role)


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


class TestDocumentsAPI:
    """Tests for Documents API endpoints."""

    @pytest.fixture
    def super_admin(self, db) -> TestUser:
        return _create_test_user(db, "super@test.com", UserRole.SUPER_ADMIN)

    @pytest.fixture
    def scheme_admin(self, db) -> TestUser:
        return _create_test_user(db, "scheme@test.com", UserRole.SCHEME_ADMIN)

    @pytest.fixture
    def scrutiny_officer(self, db) -> TestUser:
        return _create_test_user(db, "scrutiny@test.com", UserRole.SCRUTINY_OFFICER)

    @pytest.fixture
    def super_admin_client(self, super_admin, db) -> TestClient:
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
    def scheme_admin_client(self, scheme_admin, db) -> TestClient:
        client = TestClient(app)
        token = _get_token(scheme_admin)
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
    def scrutiny_officer_client(self, scrutiny_officer, db) -> TestClient:
        client = TestClient(app)
        token = _get_token(scrutiny_officer)
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
    def unauthenticated_client(self, db) -> TestClient:
        """TestClient without authentication but with test database."""
        client = TestClient(app)

        def override_get_db():
            try:
                yield db
            finally:
                pass
        app.dependency_overrides[get_db] = override_get_db
        yield client
        app.dependency_overrides.clear()

    @pytest.fixture
    def nfst_scheme(self, db) -> TestScheme:
        return _create_test_scheme(db, "NFST", load_fixture("nfst_config.json"))

    @pytest.fixture
    def application(self, db, nfst_scheme) -> TestApplication:
        return _create_test_application(db, nfst_scheme, load_fixture("nfst_config.json"))

    @pytest.fixture
    def mock_storage_service(self):
        """Mock the StorageService to avoid needing real MinIO."""
        with patch("app.api.documents.storage_service") as mock:
            mock.upload_file = MagicMock(return_value="test-key")
            mock.get_presigned_url = MagicMock(return_value="http://minio:9000/presigned-url")
            mock.delete_file = MagicMock()
            mock.generate_storage_key = MagicMock(return_value="app-id/doc-type/uuid.pdf")
            yield mock

    # ===== UPLOAD TESTS =====

    def test_upload_valid_document(
        self,
        scheme_admin_client: TestClient,
        application: TestApplication,
        mock_storage_service: MagicMock,
    ):
        """Upload a valid document type/format -> 201, Document row created with status=PENDING."""
        # Create a test PDF file
        file_content = b"%PDF-1.4 test pdf content"
        files = {"file": ("test.pdf", io.BytesIO(file_content), "application/pdf")}
        data = {"doc_type": "caste_certificate"}

        res = scheme_admin_client.post(
            f"/api/applications/{application.id}/documents",
            files=files,
            data=data,
        )

        assert res.status_code == 201
        body = res.json()
        assert body["application_id"] == str(application.id)
        assert body["doc_type"] == "caste_certificate"
        assert body["status"] == "PENDING"
        assert body["download_url"] == "http://minio:9000/presigned-url"
        assert "id" in body

        # Verify upload was called
        mock_storage_service.upload_file.assert_called_once()
        mock_storage_service.get_presigned_url.assert_called_once()

    def test_upload_invalid_doc_type_returns_400(
        self,
        scheme_admin_client: TestClient,
        application: TestApplication,
        mock_storage_service: MagicMock,
    ):
        """Upload a doc_type not in the scheme's required_documents -> 400."""
        file_content = b"%PDF-1.4 test pdf content"
        files = {"file": ("test.pdf", io.BytesIO(file_content), "application/pdf")}
        data = {"doc_type": "invalid_doc_type"}

        res = scheme_admin_client.post(
            f"/api/applications/{application.id}/documents",
            files=files,
            data=data,
        )

        assert res.status_code == 400
        body = res.json()
        assert body["detail"]["error"] == "Invalid doc_type"
        assert "invalid_doc_type" in body["detail"]["message"]
        assert "allowed_doc_types" in body["detail"]

    def test_upload_disallowed_extension_returns_400(
        self,
        scheme_admin_client: TestClient,
        application: TestApplication,
        mock_storage_service: MagicMock,
    ):
        """Upload a file with disallowed extension -> 400."""
        # caste_certificate accepts pdf, jpg, png - try to upload .docx
        file_content = b"fake docx content"
        files = {"file": ("test.docx", io.BytesIO(file_content), "application/vnd.openxmlformats-officedocument.wordprocessingml.document")}
        data = {"doc_type": "caste_certificate"}

        res = scheme_admin_client.post(
            f"/api/applications/{application.id}/documents",
            files=files,
            data=data,
        )

        assert res.status_code == 400
        body = res.json()
        assert body["detail"]["error"] == "Invalid file extension"
        assert "caste_certificate" in body["detail"]["message"]

    def test_upload_empty_file_returns_400(
        self,
        scheme_admin_client: TestClient,
        application: TestApplication,
        mock_storage_service: MagicMock,
    ):
        """Upload an empty file -> 400."""
        files = {"file": ("test.pdf", io.BytesIO(b""), "application/pdf")}
        data = {"doc_type": "caste_certificate"}

        res = scheme_admin_client.post(
            f"/api/applications/{application.id}/documents",
            files=files,
            data=data,
        )

        assert res.status_code == 400
        assert "Empty file" in res.json()["detail"]

    def test_upload_nonexistent_application_returns_404(
        self,
        scheme_admin_client: TestClient,
        mock_storage_service: MagicMock,
    ):
        """Upload to nonexistent application -> 404."""
        fake_id = str(uuid.uuid4())
        file_content = b"%PDF-1.4 test pdf content"
        files = {"file": ("test.pdf", io.BytesIO(file_content), "application/pdf")}
        data = {"doc_type": "caste_certificate"}

        res = scheme_admin_client.post(
            f"/api/applications/{fake_id}/documents",
            files=files,
            data=data,
        )

        assert res.status_code == 404

    # ===== LIST TESTS =====

    def test_list_documents_returns_presigned_urls(
        self,
        scheme_admin_client: TestClient,
        application: TestApplication,
        db,
        mock_storage_service: MagicMock,
    ):
        """List documents returns presigned URLs."""
        # Create a document in DB
        doc = TestDocument(
            application_id=application.id,
            doc_type="caste_certificate",
            storage_key="app-id/caste_certificate/uuid.pdf",
            status="PENDING",
        )
        db.add(doc)
        db.commit()

        res = scheme_admin_client.get(f"/api/applications/{application.id}/documents")

        assert res.status_code == 200
        body = res.json()
        assert len(body) == 1
        assert body[0]["id"] == str(doc.id)
        assert body[0]["download_url"] == "http://minio:9000/presigned-url"
        assert body[0]["doc_type"] == "caste_certificate"

    def test_list_documents_empty_returns_empty_list(
        self,
        scheme_admin_client: TestClient,
        application: TestApplication,
        mock_storage_service: MagicMock,
    ):
        """List documents for app with no documents returns empty list."""
        res = scheme_admin_client.get(f"/api/applications/{application.id}/documents")

        assert res.status_code == 200
        assert res.json() == []

    # ===== GET SINGLE DOCUMENT TESTS =====

    def test_get_document_returns_presigned_url(
        self,
        scheme_admin_client: TestClient,
        application: TestApplication,
        db,
        mock_storage_service: MagicMock,
    ):
        """GET single document returns presigned URL."""
        doc = TestDocument(
            application_id=application.id,
            doc_type="caste_certificate",
            storage_key="app-id/caste_certificate/uuid.pdf",
            status="PENDING",
        )
        db.add(doc)
        db.commit()
        db.refresh(doc)

        res = scheme_admin_client.get(f"/api/applications/documents/{doc.id}")

        assert res.status_code == 200
        body = res.json()
        assert body["id"] == str(doc.id)
        assert body["download_url"] == "http://minio:9000/presigned-url"

    def test_get_nonexistent_document_returns_404(
        self,
        scheme_admin_client: TestClient,
        mock_storage_service: MagicMock,
    ):
        """GET nonexistent document -> 404."""
        fake_id = str(uuid.uuid4())
        res = scheme_admin_client.get(f"/api/applications/documents/{fake_id}")
        assert res.status_code == 404

    # ===== DELETE TESTS =====

    def test_delete_document_requires_scrutiny_officer_or_super_admin(
        self,
        super_admin_client: TestClient,
        scheme_admin_client: TestClient,
        scrutiny_officer_client: TestClient,
        application: TestApplication,
        db,
        mock_storage_service: MagicMock,
    ):
        """DELETE requires SUPER_ADMIN or SCRUTINY_OFFICER role."""
        doc = TestDocument(
            application_id=application.id,
            doc_type="caste_certificate",
            storage_key="app-id/caste_certificate/uuid.pdf",
            status="PENDING",
        )
        db.add(doc)
        db.commit()
        db.refresh(doc)

        # SUPER_ADMIN should succeed
        res = super_admin_client.delete(f"/api/applications/documents/{doc.id}")
        assert res.status_code == 204

        # Create another doc for SCRUTINY_OFFICER test
        doc2 = TestDocument(
            application_id=application.id,
            doc_type="income_certificate",
            storage_key="app-id/income_certificate/uuid.pdf",
            status="PENDING",
        )
        db.add(doc2)
        db.commit()
        db.refresh(doc2)

        # SCRUTINY_OFFICER should succeed
        res = scrutiny_officer_client.delete(f"/api/applications/documents/{doc2.id}")
        assert res.status_code == 204

        # Create another doc for SCHEME_ADMIN test
        doc3 = TestDocument(
            application_id=application.id,
            doc_type="marksheet",
            storage_key="app-id/marksheet/uuid.pdf",
            status="PENDING",
        )
        db.add(doc3)
        db.commit()
        db.refresh(doc3)

        # SCHEME_ADMIN should get 403
        res = scheme_admin_client.delete(f"/api/applications/documents/{doc3.id}")
        assert res.status_code == 403

    def test_delete_removes_from_storage_and_db(
        self,
        super_admin_client: TestClient,
        application: TestApplication,
        db,
        mock_storage_service: MagicMock,
    ):
        """DELETE removes from both storage and DB."""
        doc = TestDocument(
            application_id=application.id,
            doc_type="caste_certificate",
            storage_key="app-id/caste_certificate/uuid.pdf",
            status="PENDING",
        )
        db.add(doc)
        db.commit()
        db.refresh(doc)
        doc_id = doc.id

        res = super_admin_client.delete(f"/api/applications/documents/{doc_id}")
        assert res.status_code == 204

        # Verify deleted from DB - use a fresh query to avoid ObjectDeletedError
        deleted = db.query(TestDocument).filter(TestDocument.id == doc_id).first()
        assert deleted is None

        # Verify delete_file was called
        mock_storage_service.delete_file.assert_called_once_with("app-id/caste_certificate/uuid.pdf")

    def test_delete_nonexistent_document_returns_404(
        self,
        super_admin_client: TestClient,
        mock_storage_service: MagicMock,
    ):
        """DELETE nonexistent document -> 404."""
        fake_id = str(uuid.uuid4())
        res = super_admin_client.delete(f"/api/applications/documents/{fake_id}")
        assert res.status_code == 404

    def test_unauthenticated_delete_returns_401(
        self,
        unauthenticated_client: TestClient,
        application: TestApplication,
        db,
    ):
        """Unauthenticated DELETE -> 401."""
        doc = TestDocument(
            application_id=application.id,
            doc_type="caste_certificate",
            storage_key="app-id/caste_certificate/uuid.pdf",
            status="PENDING",
        )
        db.add(doc)
        db.commit()
        db.refresh(doc)

        res = unauthenticated_client.delete(f"/api/applications/documents/{doc.id}")
        assert res.status_code == 401