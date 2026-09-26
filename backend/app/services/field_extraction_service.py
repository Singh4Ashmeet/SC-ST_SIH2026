"""
Field extraction service for extracting structured data from OCR text.

Provides robust, multi-signal field extraction, Indian certificate normalizers,
confidence scoring, and document evidence provenance tracking.
"""

from datetime import datetime
import logging
import re
from typing import Any, Dict, List, Optional

logger = logging.getLogger(__name__)

# Document types supported across NFST and NOS schemes
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

DISALLOWED_DISTRICT_WORDS = {
    "magistrate", "collector", "commissioner", "officer", "level", "office",
    "administration", "collectorate", "court", "judge", "headquarters", "council",
    "panchayat", "board", "portal", "government", "session", "sub", "divisional",
    "rural", "urban", "area", "tehsil"
}

KNOWN_AUTHORITIES = [
    "District Magistrate / Sub-Divisional Magistrate",
    "District Magistrate",
    "Sub-Divisional Magistrate",
    "Sub Divisional Magistrate",
    "Sub-Divisional Officer",
    "Sub Divisional Officer",
    "SDM",
    "SDO",
    "Tehsildar",
    "Tahsildar",
    "Executive Magistrate",
    "Revenue Officer",
    "District Collector",
    "Deputy Commissioner",
    "Competent Authority",
]


class FieldExtractor:
    """Helper utilities and normalizers for Indian certificate structures."""

    # Name patterns - matching single and multi-line label formats
    NAME_PATTERNS = [
        re.compile(
            r"(?:student\s+name|applicant\s+name|candidate\s+name|full\s+name|name)[\s:]*[\r\n]*\s*([A-Z][a-z]+(?: [A-Z][a-z]+)*)(?=\n|:|,|$)",
            re.IGNORECASE,
        ),
        re.compile(
            r"(?:This is to certify that:?\s*(?:Shri/Smt\.?|Shri|Smt|Kumari|Mr\.?|Ms\.?)\s*)([A-Z][a-z]+(?: [A-Z][a-z]+)*)",
            re.IGNORECASE,
        ),
        re.compile(
            r"(?:annual income of the family of|family of)\s+([A-Z][a-z]+(?: [A-Z][a-z]+)*)",
            re.IGNORECASE,
        ),
        re.compile(
            r"(?:certify that)\s+([A-Z][a-z]+(?: [A-Z][a-z]+)*)",
            re.IGNORECASE,
        ),
    ]

    DATE_PATTERNS = [
        re.compile(r"(?:date|issued|dob|valid until)[\s:]*(\d{2}[/-]\d{2}[/-]\d{4})", re.IGNORECASE),
        re.compile(r"(?:date|issued|dob|valid until)[\s:]*(\d{4}[/-]\d{2}[/-]\d{2})", re.IGNORECASE),
        re.compile(r"(?:date|issued|dob|valid until)[\s:]*(\d{2}[/-]\d{2}[/-]\d{2})", re.IGNORECASE),
        re.compile(r"(\d{2}[/-]\d{2}[/-]\d{4})"),
        re.compile(r"(\d{4}[/-]\d{2}[/-]\d{2})"),
        re.compile(r"(\d{2}[/-]\d{2}[/-]\d{2})"),
    ]

    AMOUNT_PATTERN = re.compile(
        r"(?:rs\.?|inr|₹|amount|income|salary)[\s:]*"
        r"([\d,]+\.?\d*)\s*(?:lakh|lac)?",
        re.IGNORECASE,
    )

    PERCENTAGE_PATTERN = re.compile(
        r"(?:percentage|cgpa|gpa|score|band|aggregate)[\s:]*(\d+(?:\.\d+)?)\s*%",
        re.IGNORECASE,
    )

    PASSPORT_PATTERN = re.compile(
        r"\b([A-Z]\d{7})\b",
    )

    @staticmethod
    def normalize_name(name_str: str) -> str:
        """Strip honorifics and clean whitespace from names."""
        clean = re.sub(
            r"^(?:Shri/Smt\.?|Shri|Smt|Kumari|Mr\.?|Ms\.?|Mrs\.?|Dr\.?|Sri)\s+",
            "",
            name_str.strip(),
            flags=re.IGNORECASE,
        )
        clean = re.sub(r"^(?:Name|Student Name|Applicant|Candidate)\s*[:=]\s*", "", clean, flags=re.IGNORECASE)
        return clean.strip()

    @staticmethod
    def normalize_date(date_str: str) -> Optional[str]:
        """Normalize date to standard ISO format (YYYY-MM-DD)."""
        if not date_str:
            return None
        clean_str = date_str.strip()

        # If already YYYY-MM-DD
        if re.match(r"^\d{4}-\d{2}-\d{2}$", clean_str):
            return clean_str

        for pattern in FieldExtractor.DATE_PATTERNS:
            match = pattern.search(clean_str)
            if match:
                date_part = match.group(1)
                # Check for YYYY-MM-DD or YYYY/MM/DD
                parts_iso = re.split(r"[-/]", date_part)
                if len(parts_iso) == 3 and len(parts_iso[0]) == 4:
                    try:
                        dt = datetime(int(parts_iso[0]), int(parts_iso[1]), int(parts_iso[2]))
                        return dt.strftime("%Y-%m-%d")
                    except ValueError:
                        pass

                # Check for DD/MM/YYYY or DD-MM-YYYY
                for sep in ["/", "-"]:
                    parts = date_part.split(sep)
                    if len(parts) == 3 and len(parts[0]) <= 2:
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
        """Extract numeric amount from text, handling Lakhs and Indian comma grouping."""
        # 1. Check for Lakh notation, e.g. "3.8 Lakh" or "Rs. 4.5 Lakhs"
        lakh_match = re.search(r"(?:rs\.?|inr|₹|income|salary)?\s*([\d,]+\.?\d*)\s*(?:lakh|lac|lakhs)", text, re.IGNORECASE)
        if lakh_match:
            try:
                num = float(lakh_match.group(1).replace(",", ""))
                return str(int(num * 100000))
            except ValueError:
                pass

        # 2. Match standard numerical values
        for match in re.finditer(r"(?:rs\.?|inr|₹|income|salary|exceed)[\s:]*([\d,]+\.?\d*)", text, re.IGNORECASE):
            raw_val = match.group(1).replace(",", "")
            try:
                val_float = float(raw_val)
                if val_float > 0:
                    return str(int(val_float))
            except ValueError:
                continue

        # Fallback to general amount pattern
        match = FieldExtractor.AMOUNT_PATTERN.search(text)
        if match:
            raw_num = match.group(1).replace(",", "")
            try:
                return str(int(float(raw_num)))
            except ValueError:
                return raw_num
        return None

    @staticmethod
    def extract_percentage(text: str) -> Optional[str]:
        """Extract percentage value from text."""
        match = FieldExtractor.PERCENTAGE_PATTERN.search(text)
        if match:
            return match.group(1)
        # Try aggregate percentage line, e.g.:
        # AGGREGATE\n3000\n2517\n83.9\nFIRST DIV
        agg_match = re.search(r"AGGREGATE[\s\S]*?(\d{2}\.\d+)", text, re.IGNORECASE)
        if agg_match:
            return agg_match.group(1)
        return None

    @staticmethod
    def extract_passport_number(text: str) -> Optional[str]:
        """Extract Indian passport number (1 letter + 7 digits)."""
        # Look for explicit label first
        lbl_match = re.search(r"Passport\s*No\.?[\s:]*[\r\n]*\s*([A-Z]\d{7})\b", text, re.IGNORECASE)
        if lbl_match:
            return lbl_match.group(1).upper()
        match = FieldExtractor.PASSPORT_PATTERN.search(text.upper())
        if match:
            return match.group(1)
        return None


def _build_field(
    name: str,
    value: Any,
    confidence: float,
    line_text: str = "",
    method: str = "pattern_match",
    page: int = 1,
    status: str = "verified"
) -> Dict[str, Any]:
    """Constructs a backward-compatible and rich evidence field item."""
    conf_clamped = max(0.10, min(0.99, confidence))
    conf_label = "high" if conf_clamped >= 0.85 else ("medium" if conf_clamped >= 0.65 else "low")
    return {
        "field": name,
        "value": value,
        "confidence": round(conf_clamped, 2),
        "confidence_label": conf_label,
        "source_page": page,
        "source_region": {"line_text": line_text.strip() if line_text else ""},
        "extraction_method": method,
        "validation_status": status,
    }


def _extract_district(text: str) -> Optional[Dict[str, Any]]:
    """Robust district extractor that skips false positives like 'District Magistrate'."""
    matches = list(re.finditer(r"\bDistrict(?:\s*:|\s+of)?\s+([A-Za-z]+(?:\s+[A-Za-z]+)?)", text, re.IGNORECASE))
    for m in matches:
        candidate = m.group(1).strip()
        first_word = candidate.split()[0].lower()
        if first_word not in DISALLOWED_DISTRICT_WORDS:
            # Strip trailing state/tehsil suffixes
            clean_cand = re.sub(r"\s+(?:State|Rural|Tehsil|Division|Pincode|Pin).*$", "", candidate, flags=re.IGNORECASE).strip()
            if clean_cand and clean_cand.lower() not in DISALLOWED_DISTRICT_WORDS:
                return _build_field("district", clean_cand, 0.94, m.group(0))
    return None


def _extract_authority(text: str) -> Optional[Dict[str, Any]]:
    """Extracts official issuing authority, identifying real designations and locations."""
    # 1. Explicit line match e.g. "Issuing Authority: District Magistrate, Ranchi" or "Tehsildar, Goalpara"
    auth_explicit = re.search(r"(?:issued by|issuing authority|authority)[\s:]*([^\n\r]+)", text, re.IGNORECASE)
    if auth_explicit:
        raw_auth = auth_explicit.group(1).strip()
        # Ensure it's not a template placeholder like "[AUTHORITY NAME]"
        if not raw_auth.startswith("[") and len(raw_auth) > 3:
            return _build_field("issuing_authority", raw_auth, 0.92, auth_explicit.group(0))

    # 2. Check for signature line designation e.g. "Tehsildar, Goalpara"
    sig_match = re.search(r"\b([A-Za-z\s]+?,\s*[A-Za-z\s]+?)(?=\n|SYNTHETIC|$)", text)
    if sig_match:
        cand = sig_match.group(1).strip()
        if any(auth.lower() in cand.lower() for auth in ["tehsildar", "magistrate", "sdo", "sdm", "collector"]):
            return _build_field("issuing_authority", cand, 0.90, sig_match.group(0))

    # 3. Scan for known recognized administrative designations
    for ka in KNOWN_AUTHORITIES:
        match = re.search(r"\b" + re.escape(ka) + r"\b", text, re.IGNORECASE)
        if match:
            return _build_field("issuing_authority", ka, 0.88, match.group(0))

    return None


# ============================================================================
# Document-specific extractors
# ============================================================================

def extract_caste_certificate(text: str) -> Dict[str, Any]:
    """Extract fields from caste/tribe certificate."""
    fields = {}

    # Applicant name
    name_found = False
    for pat in FieldExtractor.NAME_PATTERNS:
        match = pat.search(text)
        if match:
            clean_name = FieldExtractor.normalize_name(match.group(1))
            if clean_name and not any(kw in clean_name.lower() for kw in ["certificate", "government", "constitution"]):
                fields["applicant_name"] = _build_field("applicant_name", clean_name, 0.96, match.group(0))
                name_found = True
                break

    # Father's name
    father_match = re.search(
        r"(?:Son/Daughter of (?:Shri)?|S/o / D/o|S/o|D/o)\s*([A-Z][a-z]+(?: [A-Z][a-z]+)*)",
        text,
        re.IGNORECASE,
    )
    if father_match:
        clean_father = FieldExtractor.normalize_name(father_match.group(1))
        fields["father_name"] = _build_field("father_name", clean_father, 0.94, father_match.group(0))

    # Certificate Number
    cert_no_match = re.search(
        r"(?:Certificate No\.?|Cert No\.?|No\.)[:\s]*([A-Za-z0-9/-]+)",
        text,
        re.IGNORECASE,
    )
    if cert_no_match:
        fields["certificate_number"] = _build_field("certificate_number", cert_no_match.group(1).strip(), 0.95, cert_no_match.group(0))

    # Category (SC/ST/OBC)
    category_match = re.search(
        r"\b(SC|ST|OBC|Scheduled\s+[Cc]aste|Scheduled\s+[Tt]ribe|Other\s+Backward\s+Class)\b",
        text,
        re.IGNORECASE,
    )
    if category_match:
        category = category_match.group(1).upper()
        if "SCHEDULED" in category and "CASTE" in category:
            category = "SC"
        elif "SCHEDULED" in category and "TRIBE" in category:
            category = "ST"
        elif "BACKWARD" in category:
            category = "OBC"
        fields["category"] = _build_field("category", category, 0.98, category_match.group(0))

    # Tribe name
    tribe_match = re.search(r"belongs to the\s+([A-Za-z\s]+?)\s+tribe", text, re.IGNORECASE)
    if tribe_match:
        fields["tribe"] = _build_field("tribe", tribe_match.group(1).strip(), 0.96, tribe_match.group(0))
    else:
        # Fallback tribe pattern
        tr_match = re.search(r"(?:Tribe|Community)[\s:]*([A-Za-z\s]+?)(?=\n|,|$)", text, re.IGNORECASE)
        if tr_match:
            fields["tribe"] = _build_field("tribe", tr_match.group(1).strip(), 0.88, tr_match.group(0))

    # District
    dist_field = _extract_district(text)
    if dist_field:
        fields["district"] = dist_field

    # State
    state_match = re.search(r"(?:State of|State)[\s:]*([A-Za-z]+(?:\s+[A-Za-z]+)?)", text, re.IGNORECASE)
    if state_match:
        clean_state = state_match.group(1).strip()
        if clean_state.lower() not in ["government", "certificate", "jharkhand", "assam", "odisha", "bihar"] or True:
            # Strip trailing punctuation
            clean_state = clean_state.split(".")[0].strip()
            fields["state"] = _build_field("state", clean_state, 0.92, state_match.group(0))

    # Issuing authority
    auth_field = _extract_authority(text)
    if auth_field:
        fields["issuing_authority"] = auth_field

    # Issue date
    for pattern in FieldExtractor.DATE_PATTERNS:
        match = pattern.search(text)
        if match:
            normalized = FieldExtractor.normalize_date(match.group(1))
            if normalized:
                fields["issue_date"] = _build_field("issue_date", normalized, 0.92, match.group(0))
                break

    return fields


def extract_income_certificate(text: str) -> Dict[str, Any]:
    """Extract fields from income certificate."""
    fields = {}

    # Applicant name
    for pat in FieldExtractor.NAME_PATTERNS:
        match = pat.search(text)
        if match:
            clean_name = FieldExtractor.normalize_name(match.group(1))
            if clean_name and not any(kw in clean_name.lower() for kw in ["certificate", "government", "revenue", "department"]):
                fields["applicant_name"] = _build_field("applicant_name", clean_name, 0.96, match.group(0))
                break

    # Father's name
    father_match = re.search(
        r"(?:Son/Daughter of (?:Shri)?|S/o / D/o|S/o|D/o)\s*([A-Z][a-z]+(?: [A-Z][a-z]+)*)",
        text,
        re.IGNORECASE,
    )
    if father_match:
        clean_father = FieldExtractor.normalize_name(father_match.group(1))
        fields["father_name"] = _build_field("father_name", clean_father, 0.94, father_match.group(0))

    # Certificate Number
    cert_no_match = re.search(
        r"(?:Certificate No\.?|Cert No\.?|No\.)[:\s]*([A-Za-z0-9/-]+)",
        text,
        re.IGNORECASE,
    )
    if cert_no_match:
        fields["certificate_number"] = _build_field("certificate_number", cert_no_match.group(1).strip(), 0.95, cert_no_match.group(0))

    # Annual income
    income = FieldExtractor.extract_amount(text)
    if income:
        fields["annual_income"] = _build_field("annual_income", income, 0.96, f"Extracted income: {income}")

    # Financial Year
    fy_match = re.search(r"(?:financial year|fy)[\s:]*(20\d{2}-\d{2,4})", text, re.IGNORECASE)
    if fy_match:
        fields["financial_year"] = _build_field("financial_year", fy_match.group(1).strip(), 0.94, fy_match.group(0))

    # District
    dist_field = _extract_district(text)
    if dist_field:
        fields["district"] = dist_field

    # State
    state_match = re.search(r"(?:State of|State)[\s:]*([A-Za-z]+(?:\s+[A-Za-z]+)?)", text, re.IGNORECASE)
    if state_match:
        clean_state = state_match.group(1).split(".")[0].strip()
        fields["state"] = _build_field("state", clean_state, 0.92, state_match.group(0))

    # Issuing authority
    auth_field = _extract_authority(text)
    if auth_field:
        fields["issuing_authority"] = auth_field

    # Issue date
    for pattern in FieldExtractor.DATE_PATTERNS:
        match = pattern.search(text)
        if match:
            normalized = FieldExtractor.normalize_date(match.group(1))
            if normalized:
                fields["issue_date"] = _build_field("issue_date", normalized, 0.92, match.group(0))
                break

    return fields


def extract_marksheet(text: str) -> Dict[str, Any]:
    """Extract fields from marksheet / academic grade card."""
    fields = {}

    # Student name
    for pat in FieldExtractor.NAME_PATTERNS:
        match = pat.search(text)
        if match:
            clean_name = FieldExtractor.normalize_name(match.group(1))
            if clean_name and not any(kw in clean_name.lower() for kw in ["statement", "university", "controller"]):
                fields["student_name"] = _build_field("student_name", clean_name, 0.96, match.group(0))
                break

    # Father's Name
    father_match = re.search(
        r"(?:Father(?:'s)? Name|Son/Daughter of (?:Shri)?|S/o|D/o)[\s:]*([A-Z][a-z]+(?: [A-Z][a-z]+)*)",
        text,
        re.IGNORECASE,
    )
    if father_match:
        clean_father = FieldExtractor.normalize_name(father_match.group(1))
        fields["father_name"] = _build_field("father_name", clean_father, 0.94, father_match.group(0))

    # Percentage or CGPA
    pct = FieldExtractor.extract_percentage(text)
    if pct:
        fields["percentage"] = _build_field("percentage", pct, 0.95, f"Percentage: {pct}%")
    else:
        cgpa_match = re.search(r"(?:cgpa|gpa)[\s:]*(\d+\.?\d*)", text, re.IGNORECASE)
        if cgpa_match:
            fields["cgpa"] = _build_field("cgpa", cgpa_match.group(1), 0.94, cgpa_match.group(0))

    # Board or University
    uni_match = re.search(
        r"(?:^([A-Z][A-Za-z\s,]+(?:University|Institute|College|Board)[^\n]*)|(?:board|university|council)[\s:]*([^\n]+))",
        text,
        re.MULTILINE | re.IGNORECASE,
    )
    if uni_match:
        uni_val = (uni_match.group(1) or uni_match.group(2)).strip()
        fields["board_or_university"] = _build_field("board_or_university", uni_val, 0.92, uni_match.group(0))

    # Course
    course_match = re.search(r"(?:course|degree|programme|exam(?:ination)?)[\s:]*([^\n\r]+)", text, re.IGNORECASE)
    if course_match:
        fields["course"] = _build_field("course", course_match.group(1).strip(), 0.90, course_match.group(0))

    # Exam year
    year_match = re.search(r"\b(20\d{2})\b", text)
    if year_match:
        fields["exam_year"] = _build_field("exam_year", year_match.group(1), 0.90, year_match.group(0))

    return fields


def extract_bonafide_certificate(text: str) -> Dict[str, Any]:
    """Extract fields from bonafide certificate."""
    fields = {}

    # Student name
    for pat in FieldExtractor.NAME_PATTERNS:
        match = pat.search(text)
        if match:
            clean_name = FieldExtractor.normalize_name(match.group(1))
            if clean_name and not any(kw in clean_name.lower() for kw in ["bonafide", "university", "institute"]):
                fields["student_name"] = _build_field("student_name", clean_name, 0.96, match.group(0))
                break

    # Institution name
    inst_match = re.search(
        r"(?:^([A-Z][A-Za-z\s,]+(?:University|Institute|College)[^\n]*)|(?:institution|university|college|institute)[\s:]*([^\n]+))",
        text,
        re.MULTILINE | re.IGNORECASE,
    )
    if inst_match:
        inst_val = (inst_match.group(1) or inst_match.group(2)).strip()
        fields["institution_name"] = _build_field("institution_name", inst_val, 0.94, inst_match.group(0))

    # Enrollment Number
    enr_match = re.search(r"(?:enrollment\s*no\.?|enrol\.?\s*no\.?)[\s:]*([A-Za-z0-9/-]+)", text, re.IGNORECASE)
    if enr_match:
        fields["enrollment_no"] = _build_field("enrollment_no", enr_match.group(1).strip(), 0.95, enr_match.group(0))

    # Course
    course_match = re.search(r"(?:course|program|degree|currently enrolled in)[\s:]*([^\n\r,]+)", text, re.IGNORECASE)
    if course_match:
        fields["course"] = _build_field("course", course_match.group(1).strip(), 0.90, course_match.group(0))

    # Academic year
    year_match = re.search(r"(?:academic|year|session)[\s:]*(20\d{2}[-/]20\d{2}|20\d{2}-\d{2}|20\d{2})", text, re.IGNORECASE)
    if year_match:
        fields["academic_year"] = _build_field("academic_year", year_match.group(1), 0.92, year_match.group(0))

    return fields


def extract_passport(text: str) -> Dict[str, Any]:
    """Extract fields from passport."""
    fields = {}

    # Passport number
    passport = FieldExtractor.extract_passport_number(text)
    if passport:
        fields["passport_number"] = _build_field("passport_number", passport, 0.98, f"Passport No: {passport}")

    # Surname & Given Name
    surname_match = re.search(r"Surname:?[\s:]*[\r\n]*\s*([A-Za-z]+)", text, re.IGNORECASE)
    given_match = re.search(r"Given\s*Name:?[\s:]*[\r\n]*\s*([A-Za-z]+)", text, re.IGNORECASE)
    if surname_match and given_match:
        full = f"{given_match.group(1).strip()} {surname_match.group(1).strip()}".title()
        fields["full_name"] = _build_field("full_name", full, 0.96, f"{given_match.group(1)} {surname_match.group(1)}")
    else:
        for pat in FieldExtractor.NAME_PATTERNS:
            match = pat.search(text)
            if match:
                clean_name = FieldExtractor.normalize_name(match.group(1))
                if clean_name and "republic" not in clean_name.lower():
                    fields["full_name"] = _build_field("full_name", clean_name, 0.94, match.group(0))
                    break

    # Date of birth
    dob_match = re.search(r"(?:date of birth|dob)[\s:]*[\r\n]*\s*(\d{2}[/-]\d{2}[/-]\d{4})", text, re.IGNORECASE)
    if dob_match:
        normalized = FieldExtractor.normalize_date(dob_match.group(1))
        if normalized:
            fields["date_of_birth"] = _build_field("date_of_birth", normalized, 0.98, dob_match.group(0))

    # Expiry date
    exp_match = re.search(r"(?:date of expiry|expiry\s+date|expiry|expiration|valid until)[\s:]*[\r\n]*\s*(\d{2}[/-]\d{2}[/-]\d{4})", text, re.IGNORECASE)
    if exp_match:
        normalized = FieldExtractor.normalize_date(exp_match.group(1))
        if normalized:
            fields["expiry_date"] = _build_field("expiry_date", normalized, 0.98, exp_match.group(0))
    else:
        # Fallback: find all dates and take the last one (typically expiry) if different from dob
        all_dates = []
        for pattern in FieldExtractor.DATE_PATTERNS:
            for match in pattern.finditer(text):
                norm = FieldExtractor.normalize_date(match.group(1))
                if norm:
                    all_dates.append((match.start(), norm, match.group(0)))
        if all_dates:
            dob_val = fields.get("date_of_birth", {}).get("value")
            non_dob_dates = [d for d in all_dates if d[1] != dob_val]
            if non_dob_dates:
                last_d = non_dob_dates[-1]
                fields["expiry_date"] = _build_field("expiry_date", last_d[1], 0.88, last_d[2])

    # Nationality
    nat_match = re.search(r"Nationality:?[\s:]*[\r\n]*\s*([A-Za-z]+)", text, re.IGNORECASE)
    if nat_match:
        fields["nationality"] = _build_field("nationality", nat_match.group(1).strip().upper(), 0.96, nat_match.group(0))

    return fields


def extract_admission_letter(text: str) -> Dict[str, Any]:
    """Extract fields from foreign/domestic admission offer letters."""
    fields = {}

    # Applicant name
    for pat in FieldExtractor.NAME_PATTERNS:
        match = pat.search(text)
        if match:
            clean_name = FieldExtractor.normalize_name(match.group(1))
            if clean_name and not any(kw in clean_name.lower() for kw in ["admission", "university", "office"]):
                fields["applicant_name"] = _build_field("applicant_name", clean_name, 0.96, match.group(0))
                break

    # Institution name
    uni_match = re.search(
        r"(?:^([A-Z][A-Za-z\s,]+(?:University|College|Institute)[^\n]*)|(?:university|college|institute|institution)[\s:]*([^\n]+))",
        text,
        re.MULTILINE | re.IGNORECASE,
    )
    if uni_match:
        uni_val = (uni_match.group(1) or uni_match.group(2)).strip()
        fields["institution_name"] = _build_field("institution_name", uni_val, 0.95, uni_match.group(0))

    # Program
    prog_match = re.search(r"(?:programme|program|course|degree)[\s:]*[\r\n]*\s*([^\n\r]+)", text, re.IGNORECASE)
    if prog_match:
        fields["program"] = _build_field("program", prog_match.group(1).strip(), 0.92, prog_match.group(0))

    # Admission Status (Conditional / Unconditional)
    status_match = re.search(r"\b(UNCONDITIONAL|CONDITIONAL|PROVISIONAL)\b", text, re.IGNORECASE)
    if status_match:
        fields["admission_status"] = _build_field("admission_status", status_match.group(1).upper(), 0.98, status_match.group(0))

    # Admission date
    for pattern in FieldExtractor.DATE_PATTERNS:
        match = pattern.search(text)
        if match:
            normalized = FieldExtractor.normalize_date(match.group(1))
            if normalized:
                fields["admission_date"] = _build_field("admission_date", normalized, 0.92, match.group(0))
                break

    return fields


def extract_degree_transcript(text: str) -> Dict[str, Any]:
    """Extract fields from degree transcript."""
    fields = {}

    # Student name
    for pat in FieldExtractor.NAME_PATTERNS:
        match = pat.search(text)
        if match:
            clean_name = FieldExtractor.normalize_name(match.group(1))
            if clean_name and not any(kw in clean_name.lower() for kw in ["transcript", "marks", "university"]):
                fields["student_name"] = _build_field("student_name", clean_name, 0.96, match.group(0))
                break

    # Percentage / Aggregate
    pct = FieldExtractor.extract_percentage(text)
    if pct:
        fields["percentage"] = _build_field("percentage", pct, 0.95, f"Percentage: {pct}%")

    # University
    uni_match = re.search(
        r"(?:^([A-Z][A-Za-z\s,]+(?:University|Institute|College)[^\n]*)|(?:university|institute|college)[\s:]*([^\n]+))",
        text,
        re.MULTILINE | re.IGNORECASE,
    )
    if uni_match:
        uni_val = (uni_match.group(1) or uni_match.group(2)).strip()
        fields["university"] = _build_field("university", uni_val, 0.94, uni_match.group(0))

    # Result / Division
    res_match = re.search(r"\b(FIRST DIV|DISTINCTION|SECOND DIV|PASS)\b", text, re.IGNORECASE)
    if res_match:
        fields["result"] = _build_field("result", res_match.group(1).upper(), 0.94, res_match.group(0))

    # Graduation year
    year_match = re.search(r"(?:year|graduated|passed)[\s:]*(20\d{2})", text, re.IGNORECASE)
    if year_match:
        fields["graduation_year"] = _build_field("graduation_year", year_match.group(1), 0.92, year_match.group(0))

    return fields


def extract_ielts_toefl_scorecard(text: str) -> Dict[str, Any]:
    """Extract fields from IELTS/TOEFL scorecard."""
    fields = {}

    # Candidate Name
    cand_match = re.search(r"Candidate\s*Name:?[\s:]*[\r\n]*\s*([A-Za-z]+(?:\s+[A-Za-z]+)*)", text, re.IGNORECASE)
    if cand_match:
        clean_name = FieldExtractor.normalize_name(cand_match.group(1))
        fields["candidate_name"] = _build_field("candidate_name", clean_name, 0.96, cand_match.group(0))
    else:
        for pat in FieldExtractor.NAME_PATTERNS:
            match = pat.search(text)
            if match:
                clean_name = FieldExtractor.normalize_name(match.group(1))
                fields["candidate_name"] = _build_field("candidate_name", clean_name, 0.92, match.group(0))
                break

    # Test type
    if "ielts" in text.lower():
        fields["test_type"] = _build_field("test_type", "IELTS", 0.99, "IELTS Test Report")
    elif "toefl" in text.lower():
        fields["test_type"] = _build_field("test_type", "TOEFL", 0.99, "TOEFL Test Report")

    # Overall score / Band
    score_match = re.search(
        r"(?:overall\s*band(?:\s*score)?|total\s*score|overall)[\s:]*[\r\n]*\s*(\d+(?:\.\d+)?)",
        text,
        re.IGNORECASE,
    )
    if score_match:
        fields["overall_score"] = _build_field("overall_score", score_match.group(1), 0.98, score_match.group(0))

    # Individual band scores (for IELTS)
    bands = re.findall(
        r"(?:listening|reading|writing|speaking)[\s:]*(\d+\.?\d*)",
        text,
        re.IGNORECASE,
    )
    if bands:
        fields["band_scores"] = _build_field("band_scores", bands, 0.90, "Section Bands")

    # Test date
    for pattern in FieldExtractor.DATE_PATTERNS:
        match = pattern.search(text)
        if match:
            normalized = FieldExtractor.normalize_date(match.group(1))
            if normalized:
                fields["test_date"] = _build_field("test_date", normalized, 0.95, match.group(0))
                break

    return fields


# ============================================================================
# Main extraction dispatcher
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
    Extract structured fields from OCR text with confidence and provenance metadata.

    Args:
        raw_text: Raw OCR output text
        doc_type: Document type matching one of the supported types

    Returns:
        Dictionary of extracted fields with value, confidence, and provenance metadata.
    """
    if not raw_text or not raw_text.strip():
        logger.warning(f"Empty text provided for doc_type: {doc_type}")
        return {}

    if doc_type not in EXTRACTORS:
        logger.warning(f"No extractor registered for doc_type: {doc_type}")
        return {}

    try:
        return EXTRACTORS[doc_type](raw_text)
    except Exception as e:
        logger.warning(f"Field extraction failed for {doc_type}: {e}")
        return {}