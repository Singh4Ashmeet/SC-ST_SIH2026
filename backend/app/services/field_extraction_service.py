"""
Field extraction service for extracting structured data from OCR text.

Uses regex patterns and heuristics to extract common fields from different document types.
"""

import logging
import re
from datetime import datetime
from typing import Any, Dict, Optional

logger = logging.getLogger(__name__)


# Document types that need extractors (from NFST and NOS configs)
DOC_TYPES = {
    "caste_certificate",
    "income_certificate",
    "marksheet",
    "bonafide_certificate",
    "passport",
    "admission_letter",
    "degree_transcript",
    "ielts_toefl_scorecard",
}


class FieldExtractor:
    """Base class for field extraction with common utilities."""

    # Common regex patterns - more precise to avoid over-matching
    # Match name until newline, colon, or end of string
    NAME_PATTERN = re.compile(
        r"(?:student\s+name|applicant\s+name|name|applicant|student|candidate)[ \t:]+([A-Z][a-z]+(?: [A-Z][a-z]+)*)(?=\n|:|$)",
        re.IGNORECASE,
    )

    # Date patterns for Indian formats - more precise
    DATE_PATTERNS = [
        re.compile(r"(?:date|issued|dob)[\s:]*(\d{2}[/-]\d{2}[/-]\d{4})", re.IGNORECASE),  # DD/MM/YYYY or DD-MM-YYYY
        re.compile(r"(?:date|issued|dob)[\s:]*(\d{2}[/-]\d{2}[/-]\d{2})", re.IGNORECASE),  # DD/MM/YY or DD-MM-YY
        re.compile(r"(\d{2}[/-]\d{2}[/-]\d{4})"),  # DD/MM/YYYY or DD-MM-YYYY (fallback)
        re.compile(r"(\d{2}[/-]\d{2}[/-]\d{2})"),  # DD/MM/YY or DD-MM-YY (fallback)
    ]

    # Currency/amount patterns - more precise
    AMOUNT_PATTERN = re.compile(
        r"(?:rs\.?|inr|amount|income|salary)[\s:]*"
        r"([\d,]+\.?\d*)",
        re.IGNORECASE,
    )

    # Percentage pattern - more precise
    PERCENTAGE_PATTERN = re.compile(
        r"(?:percentage|cgpa|gpa|score|band)[\s:]*(\d+(?:\.\d+)?)\s*%",
        re.IGNORECASE,
    )

    # Passport number pattern (Indian format: 1 letter + 7 digits)
    PASSPORT_PATTERN = re.compile(
        r"\b([A-Z]\d{7})\b",
    )

    @staticmethod
    def normalize_date(date_str: str) -> Optional[str]:
        """Try to normalize date to ISO format (YYYY-MM-DD)."""
        for pattern in FieldExtractor.DATE_PATTERNS:
            match = pattern.search(date_str)
            if match:
                date_part = match.group(1)
                # Try DD/MM/YYYY or DD-MM-YYYY
                for sep in ["/", "-"]:
                    parts = date_part.split(sep)
                    if len(parts) == 3:
                        try:
                            day, month, year = parts
                            if len(year) == 2:
                                year = "20" + year if int(year) < 50 else "19" + year
                            dt = datetime(int(year), int(month), int(day))
                            return dt.strftime("%Y-%m-%d")
                        except ValueError:
                            continue
        return None

    @staticmethod
    def extract_amount(text: str) -> Optional[str]:
        """Extract numeric amount from text."""
        match = FieldExtractor.AMOUNT_PATTERN.search(text)
        if match:
            return match.group(1).replace(",", "")
        return None

    @staticmethod
    def extract_percentage(text: str) -> Optional[str]:
        """Extract percentage value from text."""
        match = FieldExtractor.PERCENTAGE_PATTERN.search(text)
        if match:
            return match.group(1)
        return None

    @staticmethod
    def extract_passport_number(text: str) -> Optional[str]:
        """Extract Indian passport number."""
        match = FieldExtractor.PASSPORT_PATTERN.search(text.upper())
        if match:
            return match.group(1)  # group(1) for the capturing group
        return None


# ============================================================================
# Document-specific extractors
# ============================================================================

def extract_caste_certificate(text: str) -> Dict[str, Any]:
    """Extract fields from caste/tribe certificate."""
    fields = {}

    # Applicant name
    name_match = FieldExtractor.NAME_PATTERN.search(text)
    if name_match:
        fields["applicant_name"] = {
            "value": name_match.group(1).strip(),
            "confidence": "high",
        }

    # Category (SC/ST/OBC)
    category_match = re.search(
        r"\b(SC|ST|OBC|Scheduled\s+[Cc]aste|Scheduled\s+[Tt]ribe|Other\s+Backward\s+Class)\b",
        text,
        re.IGNORECASE,
    )
    if category_match:
        category = category_match.group(1).upper()
        # Normalize to standard codes
        if "SCHEDULED" in category and "CASTE" in category:
            category = "SC"
        elif "SCHEDULED" in category and "TRIBE" in category:
            category = "ST"
        elif "BACKWARD" in category:
            category = "OBC"
        fields["category"] = {
            "value": category,
            "confidence": "high",
        }

    # Issuing authority
    auth_match = re.search(
        r"(?:issued by|issuing authority|authority)[\s:]*([^\n]+)",
        text,
        re.IGNORECASE,
    )
    if auth_match:
        fields["issuing_authority"] = {
            "value": auth_match.group(1).strip(),
            "confidence": "medium",
        }

    # Issue date
    for pattern in FieldExtractor.DATE_PATTERNS:
        match = pattern.search(text)
        if match:
            normalized = FieldExtractor.normalize_date(match.group(1))
            if normalized:
                fields["issue_date"] = {
                    "value": normalized,
                    "confidence": "medium",
                }
            else:
                fields["issue_date"] = {
                    "value": match.group(1),
                    "confidence": "low",
                }
            break

    return fields


def extract_income_certificate(text: str) -> Dict[str, Any]:
    """Extract fields from income certificate."""
    fields = {}

    # Applicant name
    name_match = FieldExtractor.NAME_PATTERN.search(text)
    if name_match:
        fields["applicant_name"] = {
            "value": name_match.group(1).strip(),
            "confidence": "high",
        }

    # Annual income
    income = FieldExtractor.extract_amount(text)
    if income:
        fields["annual_income"] = {
            "value": income,
            "confidence": "high",
        }
    else:
        # Try more specific patterns
        income_match = re.search(
            r"(?:annual|yearly)[\s]+(?:income|salary)[\s:]*"
            r"([\d,]+\.?\d*)",
            text,
            re.IGNORECASE,
        )
        if income_match:
            fields["annual_income"] = {
                "value": income_match.group(1).replace(",", ""),
                "confidence": "high",
            }

    # Issuing authority
    auth_match = re.search(
        r"(?:issued by|issuing authority|authority)[\s:]*([^\n]+)",
        text,
        re.IGNORECASE,
    )
    if auth_match:
        fields["issuing_authority"] = {
            "value": auth_match.group(1).strip(),
            "confidence": "medium",
        }

    # Issue date
    for pattern in FieldExtractor.DATE_PATTERNS:
        match = pattern.search(text)
        if match:
            normalized = FieldExtractor.normalize_date(match.group(1))
            if normalized:
                fields["issue_date"] = {
                    "value": normalized,
                    "confidence": "medium",
                }
            else:
                fields["issue_date"] = {
                    "value": match.group(1),
                    "confidence": "low",
                }
            break

    return fields


def extract_marksheet(text: str) -> Dict[str, Any]:
    """Extract fields from marksheet."""
    fields = {}

    # Student name
    name_match = FieldExtractor.NAME_PATTERN.search(text)
    if name_match:
        fields["student_name"] = {
            "value": name_match.group(1).strip(),
            "confidence": "high",
        }

    # Percentage or CGPA
    # Try percentage first
    pct = FieldExtractor.extract_percentage(text)
    if pct:
        fields["percentage"] = {
            "value": pct,
            "confidence": "high",
        }
    else:
        # Try CGPA
        cgpa_match = re.search(
            r"(?:cgpa|gpa)[\s:]*(\d+\.?\d*)",
            text,
            re.IGNORECASE,
        )
        if cgpa_match:
            fields["cgpa"] = {
                "value": cgpa_match.group(1),
                "confidence": "high",
            }

    # Board/University
    board_match = re.search(
        r"(?:board|university|council)[\s:]*([^\n]+)",
        text,
        re.IGNORECASE,
    )
    if board_match:
        fields["board_or_university"] = {
            "value": board_match.group(1).strip(),
            "confidence": "medium",
        }

    # Exam year
    year_match = re.search(r"\b(20\d{2})\b", text)
    if year_match:
        fields["exam_year"] = {
            "value": year_match.group(1),
            "confidence": "medium",
        }

    return fields


def extract_bonafide_certificate(text: str) -> Dict[str, Any]:
    """Extract fields from bonafide certificate."""
    fields = {}

    # Student name
    name_match = FieldExtractor.NAME_PATTERN.search(text)
    if name_match:
        fields["student_name"] = {
            "value": name_match.group(1).strip(),
            "confidence": "high",
        }

    # Institution name
    inst_match = re.search(
        r"(?:institution|university|college|institute)[\s:]*([^\n]+)",
        text,
        re.IGNORECASE,
    )
    if inst_match:
        fields["institution_name"] = {
            "value": inst_match.group(1).strip(),
            "confidence": "high",
        }

    # Course
    course_match = re.search(
        r"(?:course|program|degree|branch)[\s:]*([^\n]+)",
        text,
        re.IGNORECASE,
    )
    if course_match:
        fields["course"] = {
            "value": course_match.group(1).strip(),
            "confidence": "medium",
        }

    # Academic year
    year_match = re.search(
        r"(?:academic|year|session)[\s:]*"
        r"(20\d{2}[-/]20\d{2}|20\d{2})",
        text,
        re.IGNORECASE,
    )
    if year_match:
        fields["academic_year"] = {
            "value": year_match.group(1),
            "confidence": "medium",
        }

    return fields


def extract_passport(text: str) -> Dict[str, Any]:
    """Extract fields from passport."""
    fields = {}

    # Full name
    name_match = FieldExtractor.NAME_PATTERN.search(text)
    if name_match:
        fields["full_name"] = {
            "value": name_match.group(1).strip(),
            "confidence": "high",
        }

    # Passport number
    passport = FieldExtractor.extract_passport_number(text)
    if passport:
        fields["passport_number"] = {
            "value": passport,
            "confidence": "high",
        }

    # Date of birth - specifically look for "date of birth" or "dob" label
    dob_match = re.search(
        r"(?:date of birth|dob)[\s:]*(\d{2}[/-]\d{2}[/-]\d{4})",
        text,
        re.IGNORECASE,
    )
    if dob_match:
        normalized = FieldExtractor.normalize_date(dob_match.group(1))
        if normalized:
            fields["date_of_birth"] = {
                "value": normalized,
                "confidence": "high",
            }
        else:
            fields["date_of_birth"] = {
                "value": dob_match.group(1),
                "confidence": "low",
            }
    else:
        # Fallback to generic date patterns
        for pattern in FieldExtractor.DATE_PATTERNS:
            match = pattern.search(text)
            if match:
                normalized = FieldExtractor.normalize_date(match.group(1))
                if normalized:
                    fields["date_of_birth"] = {
                        "value": normalized,
                        "confidence": "medium",
                    }
                else:
                    fields["date_of_birth"] = {
                        "value": match.group(1),
                        "confidence": "low",
                    }
                break

    # Expiry date - specifically look for "expiry" or "expiration" label
    exp_match = re.search(
        r"(?:expiry|expiration|valid until)[\s:]*(\d{2}[/-]\d{2}[/-]\d{4})",
        text,
        re.IGNORECASE,
    )
    if exp_match:
        normalized = FieldExtractor.normalize_date(exp_match.group(1))
        if normalized:
            fields["expiry_date"] = {
                "value": normalized,
                "confidence": "high",
            }
        else:
            fields["expiry_date"] = {
                "value": exp_match.group(1),
                "confidence": "low",
            }
    else:
        # Fallback to generic date patterns - find the last date in text
        dates = []
        for pattern in FieldExtractor.DATE_PATTERNS:
            for match in pattern.finditer(text):
                normalized = FieldExtractor.normalize_date(match.group(1))
                if normalized:
                    dates.append((match.start(), normalized))
        if dates:
            # Use the last date found (likely expiry date)
            fields["expiry_date"] = {
                "value": dates[-1][1],
                "confidence": "medium",
            }

    return fields


def extract_admission_letter(text: str) -> Dict[str, Any]:
    """Extract fields from admission letter."""
    fields = {}

    # Applicant name
    name_match = FieldExtractor.NAME_PATTERN.search(text)
    if name_match:
        fields["applicant_name"] = {
            "value": name_match.group(1).strip(),
            "confidence": "high",
        }

    # Institution name
    inst_match = re.search(
        r"(?:university|college|institute|institution)[\s:]*([^\n]+)",
        text,
        re.IGNORECASE,
    )
    if inst_match:
        fields["institution_name"] = {
            "value": inst_match.group(1).strip(),
            "confidence": "high",
        }

    # Program
    prog_match = re.search(
        r"(?:program|course|degree|major)[\s:]*([^\n]+)",
        text,
        re.IGNORECASE,
    )
    if prog_match:
        fields["program"] = {
            "value": prog_match.group(1).strip(),
            "confidence": "medium",
        }

    # Admission date
    for pattern in FieldExtractor.DATE_PATTERNS:
        match = pattern.search(text)
        if match:
            normalized = FieldExtractor.normalize_date(match.group(1))
            if normalized:
                fields["admission_date"] = {
                    "value": normalized,
                    "confidence": "medium",
                }
            else:
                fields["admission_date"] = {
                    "value": match.group(1),
                    "confidence": "low",
                }
            break

    return fields


def extract_degree_transcript(text: str) -> Dict[str, Any]:
    """Extract fields from degree transcript."""
    fields = {}

    # Student name
    name_match = FieldExtractor.NAME_PATTERN.search(text)
    if name_match:
        fields["student_name"] = {
            "value": name_match.group(1).strip(),
            "confidence": "high",
        }

    # Degree/Percentage
    pct = FieldExtractor.extract_percentage(text)
    if pct:
        fields["percentage"] = {
            "value": pct,
            "confidence": "high",
        }
    else:
        cgpa_match = re.search(
            r"(?:cgpa|gpa)[\s:]*(\d+\.?\d*)",
            text,
            re.IGNORECASE,
        )
        if cgpa_match:
            fields["cgpa"] = {
                "value": cgpa_match.group(1),
                "confidence": "high",
            }

    # University
    uni_match = re.search(
        r"(?:university|institute|college)[\s:]*([^\n]+)",
        text,
        re.IGNORECASE,
    )
    if uni_match:
        fields["university"] = {
            "value": uni_match.group(1).strip(),
            "confidence": "medium",
        }

    # Graduation year
    year_match = re.search(
        r"(?:year|graduated|passed)[\s:]*"
        r"(20\d{2})",
        text,
        re.IGNORECASE,
    )
    if year_match:
        fields["graduation_year"] = {
            "value": year_match.group(1),
            "confidence": "medium",
        }

    return fields


def extract_ielts_toefl_scorecard(text: str) -> Dict[str, Any]:
    """Extract fields from IELTS/TOEFL scorecard."""
    fields = {}

    # Test type
    if "ielts" in text.lower():
        fields["test_type"] = {
            "value": "IELTS",
            "confidence": "high",
        }
    elif "toefl" in text.lower():
        fields["test_type"] = {
            "value": "TOEFL",
            "confidence": "high",
        }

    # Overall score
    score_match = re.search(
        r"(?:overall|total|band)[\s:]*(\d+\.?\d*)",
        text,
        re.IGNORECASE,
    )
    if score_match:
        fields["overall_score"] = {
            "value": score_match.group(1),
            "confidence": "high",
        }

    # Individual band scores (for IELTS)
    bands = re.findall(
        r"(?:listening|reading|writing|speaking)[\s:]*(\d+\.?\d*)",
        text,
        re.IGNORECASE,
    )
    if bands:
        fields["band_scores"] = {
            "value": bands,
            "confidence": "medium",
        }

    # Test date
    for pattern in FieldExtractor.DATE_PATTERNS:
        match = pattern.search(text)
        if match:
            normalized = FieldExtractor.normalize_date(match.group(1))
            if normalized:
                fields["test_date"] = {
                    "value": normalized,
                    "confidence": "medium",
                }
            else:
                fields["test_date"] = {
                    "value": match.group(1),
                    "confidence": "low",
                }
            break

    return fields


# ============================================================================
# Main extraction function
# ============================================================================

EXTRACTORS = {
    "caste_certificate": extract_caste_certificate,
    "income_certificate": extract_income_certificate,
    "marksheet": extract_marksheet,
    "bonafide_certificate": extract_bonafide_certificate,
    "passport": extract_passport,
    "admission_letter": extract_admission_letter,
    "degree_transcript": extract_degree_transcript,
    "ielts_toefl_scorecard": extract_ielts_toefl_scorecard,
}


def extract_fields(raw_text: str, doc_type: str) -> Dict[str, Any]:
    """
    Extract structured fields from OCR text based on document type.

    Args:
        raw_text: Raw OCR output text
        doc_type: Document type (must match one of the supported types)

    Returns:
        Dictionary of extracted fields with value and confidence.
        Fields not found are omitted (not set to null).
    """
    if not raw_text or not raw_text.strip():
        logger.warning(f"Empty text provided for doc_type: {doc_type}")
        return {}

    if doc_type not in EXTRACTORS:
        logger.warning(f"No extractor registered for doc_type: {doc_type}")
        return {}

    try:
        fields = EXTRACTORS[doc_type](raw_text)
        return fields
    except Exception as e:
        logger.warning(f"Field extraction failed for {doc_type}: {e}")
        return {}