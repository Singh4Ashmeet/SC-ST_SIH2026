"""
Deficiency detection engine for document validation.

Rule-based checks against extracted document fields to detect deficiencies.
"""

from dataclasses import dataclass, field
from datetime import datetime, timedelta
from typing import Any, Dict, List, Optional, Set
import re

from app.models.document import Document
from app.schemas.scheme_config import SchemeConfig, RequiredDocument
from app.services.field_extraction_service import EXTRACTORS, FieldExtractor

# Field definitions per doc_type (shared with field_extraction_service)
# These are the fields that each document type should have
DOC_TYPE_FIELDS: Dict[str, List[str]] = {
    "caste_certificate": ["applicant_name", "category", "issuing_authority", "issue_date"],
    "income_certificate": ["applicant_name", "annual_income", "issuing_authority", "issue_date"],
    "marksheet": ["student_name", "percentage", "board_or_university", "exam_year"],
    "bonafide_certificate": ["student_name", "institution_name", "course", "academic_year"],
    "passport": ["full_name", "passport_number", "date_of_birth", "expiry_date"],
    "admission_letter": ["applicant_name", "institution_name", "program", "admission_date"],
    "degree_transcript": ["student_name", "percentage", "university", "graduation_year"],
    "ielts_toefl_scorecard": ["test_type", "overall_score", "band_scores", "test_date"],
}

# Date patterns for validation
DATE_PATTERNS = [
    r"^\d{4}-\d{2}-\d{2}$",  # YYYY-MM-DD (ISO format)
    r"^\d{2}/\d{2}/\d{4}$",  # DD/MM/YYYY
    r"^\d{2}-\d{2}-\d{4}$",  # DD-MM-YYYY
    r"^\d{2}/\d{2}/\d{2}$",  # DD/MM/YY
    r"^\d{2}-\d{2}-\d{2}$",  # DD-MM-YY
]

VALID_CATEGORIES = {"SC", "ST", "OBC", "GENERAL", "GEN"}

# Default validity window in days
DEFAULT_VALIDITY_DAYS = 365

# Document types where expiry check makes sense
EXPIRY_APPLICABLE_DOC_TYPES: Set[str] = {
    "caste_certificate",
    "income_certificate",
    "passport",
    "admission_letter",
}


@dataclass
class DeficiencyReason:
    """A single deficiency reason."""
    code: str
    field: Optional[str]
    message: str


@dataclass
class DeficiencyCheck:
    """Result of deficiency check on a document."""
    is_deficient: bool
    reasons: List[Dict[str, Any]] = field(default_factory=list)


def _get_expected_fields(doc_type: str) -> List[str]:
    """Get expected fields for a document type from field_extraction_service."""
    return DOC_TYPE_FIELDS.get(doc_type, [])


def _get_field_value(extracted: Dict[str, Any], field_name: str) -> Optional[str]:
    """Extract the actual value from a field dict (handles {'value': ..., 'confidence': ...} format)."""
    field_data = extracted.get(field_name)
    if field_data is None:
        return None
    if isinstance(field_data, dict) and "value" in field_data:
        return field_data["value"]
    return str(field_data) if field_data else None


def _has_field(extracted: Dict[str, Any], field_name: str) -> bool:
    """Check if a field exists and has a non-empty value."""
    val = _get_field_value(extracted, field_name)
    return val is not None and val != ""


def _parse_date(date_str: str) -> Optional[datetime]:
    """Try to parse a date string into a datetime object."""
    for pattern in DATE_PATTERNS:
        if re.match(pattern, date_str):
            if '/' in date_str:
                parts = date_str.split('/')
            elif '-' in date_str:
                parts = date_str.split('-')
            else:
                continue

            if len(parts) == 3:
                try:
                    # Check if it's ISO format (YYYY-MM-DD)
                    if len(parts[0]) == 4:
                        year, month, day = parts
                    else:
                        day, month, year = parts
                        if len(year) == 2:
                            year = "20" + year if int(year) < 50 else "19" + year
                    return datetime(int(year), int(month), int(day))
                except ValueError:
                    continue
    return None


def _is_valid_date(date_str: str) -> bool:
    """Check if a string is a valid date."""
    return _parse_date(date_str) is not None


def _is_valid_amount(value: str) -> bool:
    """Check if a string is a valid positive number (with optional commas)."""
    try:
        cleaned = value.replace(",", "")
        float(cleaned)
        return float(cleaned) >= 0
    except ValueError:
        return False


def _is_valid_category(value: str) -> bool:
    """Check if a category value is valid."""
    return value.upper() in VALID_CATEGORIES


def check_document(document: Document, scheme_config: SchemeConfig) -> DeficiencyCheck:
    """
    Run deficiency checks on a document's extracted fields.

    Args:
        document: Document with extracted_fields populated
        scheme_config: Scheme configuration with required_documents

    Returns:
        DeficiencyCheck with is_deficient flag and list of reasons
    """
    reasons: List[Dict[str, Any]] = []
    extracted = document.extracted_fields or {}

    # Get expected fields for this document type
    expected_fields = _get_expected_fields(document.doc_type)

    # 1. MISSING_FIELD: Check for missing required fields
    for field_name in expected_fields:
        if not _has_field(extracted, field_name):
            reasons.append({
                "code": "MISSING_FIELD",
                "field": field_name,
                "message": f"Required field '{field_name}' is missing or empty"
            })

    # 2. FORMAT_INVALID: Validate field formats
    # annual_income should be a positive number
    annual_income_val = _get_field_value(extracted, "annual_income")
    if annual_income_val is not None:
        if not _is_valid_amount(annual_income_val):
            reasons.append({
                "code": "FORMAT_INVALID",
                "field": "annual_income",
                "message": f"annual_income must be a valid positive number, got: {annual_income_val}"
            })

    # percentage/cgpa/overall_score should be a valid number in range
    for field_name in ["percentage", "cgpa", "overall_score"]:
        val = _get_field_value(extracted, field_name)
        if val is not None:
            try:
                num_val = float(val.replace("%", ""))
                if num_val < 0 or num_val > 100:
                    reasons.append({
                        "code": "FORMAT_INVALID",
                        "field": field_name,
                        "message": f"{field_name} must be between 0 and 100, got: {val}"
                    })
            except ValueError:
                reasons.append({
                    "code": "FORMAT_INVALID",
                    "field": field_name,
                    "message": f"{field_name} must be a valid number, got: {val}"
                })

    # category should be valid
    category_val = _get_field_value(extracted, "category")
    if category_val is not None:
        if not _is_valid_category(category_val):
            reasons.append({
                "code": "FORMAT_INVALID",
                "field": "category",
                "message": f"category must be one of {sorted(VALID_CATEGORIES)}, got: {category_val}"
            })

    # Date fields should be valid dates
    date_fields = ["issue_date", "date_of_birth", "expiry_date", "admission_date", "test_date", "graduation_year"]
    for field_name in date_fields:
        val = _get_field_value(extracted, field_name)
        if val is not None:
            if not _is_valid_date(val):
                reasons.append({
                    "code": "FORMAT_INVALID",
                    "field": field_name,
                    "message": f"{field_name} must be a valid date (DD/MM/YYYY or similar), got: {val}"
                })

    # passport_number format
    passport_val = _get_field_value(extracted, "passport_number")
    if passport_val is not None:
        if not re.match(r'^[A-Z]\d{7}$', passport_val.upper()):
            reasons.append({
                "code": "FORMAT_INVALID",
                "field": "passport_number",
                "message": f"passport_number must be 1 letter followed by 7 digits, got: {passport_val}"
            })

    # 3. EXPIRED_DATE: Check for expired documents
    if document.doc_type in EXPIRY_APPLICABLE_DOC_TYPES:
        # Check issue_date or similar for expiry
        date_field = None
        for candidate in ["issue_date", "date_of_birth", "admission_date"]:
            if _has_field(extracted, candidate):
                date_field = candidate
                break

        if date_field:
            date_val = _get_field_value(extracted, date_field)
            if date_val:
                parsed_date = _parse_date(date_val)
                if parsed_date:
                    validity_days = DEFAULT_VALIDITY_DAYS
                    # Check for per-doc-type validity override in scheme config
                    for req_doc in scheme_config.required_documents:
                        if req_doc.doc_type == document.doc_type and req_doc.validity_days:
                            validity_days = req_doc.validity_days
                            break

                    expiry_date = parsed_date + timedelta(days=validity_days)
                    if datetime.now() > expiry_date:
                        reasons.append({
                            "code": "EXPIRED_DATE",
                            "field": date_field,
                            "message": f"Document expired on {expiry_date.strftime('%Y-%m-%d')} (issued {parsed_date.strftime('%Y-%m-%d')}, validity {validity_days} days)"
                        })

    # 4. DOC_TYPE_MISMATCH: Check if extracted fields are nearly empty despite OCR text
    raw_text = extracted.get("_raw_text", "")
    extracted_fields = {k: v for k, v in extracted.items() if k != "_raw_text"}

    if raw_text and len(raw_text.strip()) > 50 and len(extracted_fields) < 2:
        reasons.append({
            "code": "DOC_TYPE_MISMATCH",
            "field": None,
            "message": f"OCR extracted substantial text ({len(raw_text)} chars) but very few fields recognized ({len(extracted_fields)}). Possible wrong document type uploaded."
        })

    # 5. LOW_CONFIDENCE_FIELD: Flag low confidence fields
    for field_name, field_data in extracted_fields.items():
        if isinstance(field_data, dict) and "confidence" in field_data:
            confidence = field_data.get("confidence", "")
            if confidence == "low":
                reasons.append({
                    "code": "LOW_CONFIDENCE_FIELD",
                    "field": field_name,
                    "message": f"Field '{field_name}' has low confidence in extraction"
                })

    is_deficient = len(reasons) > 0 and not all(r["code"] == "LOW_CONFIDENCE_FIELD" for r in reasons)
    return DeficiencyCheck(is_deficient=is_deficient, reasons=reasons)


def check_application_documents(application, scheme_config, db) -> Dict[str, DeficiencyCheck]:
    """
    Run deficiency checks on all documents for an application.

    Returns:
        Dict mapping document_id -> DeficiencyCheck
    """
    from app.models.document import Document

    documents = db.query(Document).filter(Document.application_id == application.id).all()
    results = {}
    for doc in documents:
        results[str(doc.id)] = check_document(doc, scheme_config)
    return results