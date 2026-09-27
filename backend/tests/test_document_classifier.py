"""
Tests for DocumentClassifierService (EfficientNet-B0 visual document classifier).
"""

import io
import pytest
from PIL import Image
from app.services.document_classifier_service import (
    get_document_classifier_service,
    classify_document,
    DocumentClassifierService,
    DOCUMENT_CLASSES,
)


def _generate_test_image_bytes() -> bytes:
    """Generate a simple RGB PNG image in memory for testing."""
    img = Image.new("RGB", (224, 224), color=(240, 240, 240))
    buf = io.BytesIO()
    img.save(buf, format="PNG")
    return buf.getvalue()


class TestDocumentClassifierService:
    """Tests for document classification service."""

    def test_service_initialization(self):
        """Test singleton accessor returns DocumentClassifierService instance."""
        service = get_document_classifier_service()
        assert isinstance(service, DocumentClassifierService)
        assert len(service.classes) == 8
        assert "caste_certificate" in service.classes
        assert "passport" in service.classes

    def test_classify_empty_bytes_fallback(self):
        """Test that empty or None bytes return fallback safely."""
        res = classify_document(b"", "image/png", claimed_doc_type="income_certificate")
        assert "predicted_class" in res
        assert "confidence" in res
        assert "class_probabilities" in res

    def test_classify_unsupported_mime_fallback(self):
        """Test that unsupported mime types handle safely."""
        res = classify_document(b"random bytes", "application/zip", claimed_doc_type="caste_certificate")
        assert "predicted_class" in res
        assert "confidence" in res

    def test_classify_valid_image(self):
        """Test inference on a valid image."""
        img_bytes = _generate_test_image_bytes()
        res = classify_document(img_bytes, "image/png", claimed_doc_type="caste_certificate")
        assert "predicted_class" in res
        assert "confidence" in res
        assert "class_probabilities" in res
        assert res["predicted_class"] in DOCUMENT_CLASSES
        assert 0.0 <= res["confidence"] <= 1.0
        assert isinstance(res["class_probabilities"], dict)

    def test_document_classes_defined(self):
        """Verify 8 standard target document classes."""
        expected = [
            "caste_certificate",
            "income_certificate",
            "marksheet",
            "bonafide_certificate",
            "passport",
            "admission_letter",
            "degree_transcript",
            "ielts_toefl_scorecard",
        ]
        assert DOCUMENT_CLASSES == expected
