"""
Dynamic Official Document PDF Generator for Yojana Setu (SIH26239).

Generates high-fidelity, authentic government and university certificate PDFs
matching the exact applicant profile, application state, and extracted fields.
"""

import io
import math
from datetime import datetime, timezone
from typing import Any, Dict, Optional

from reportlab.lib import colors
from reportlab.lib.pagesizes import A4
from reportlab.pdfgen import canvas


def _get_applicant_state(applicant_data: Dict[str, Any], default: str = "JHARKHAND") -> str:
    st = applicant_data.get("state") or applicant_data.get("domicile_state") or default
    return str(st).strip().upper()


def _get_father_name(applicant_name: str, applicant_data: Dict[str, Any]) -> str:
    if "father_name" in applicant_data:
        return str(applicant_data["father_name"])
    if "father" in applicant_data:
        return str(applicant_data["father"])
    parts = applicant_name.split()
    if len(parts) >= 3:
        # e.g. "Kavita Ramesh Soren" -> "Ramesh Soren"
        return f"Shri {parts[1]} {parts[2]}"
    elif len(parts) == 2:
        return f"Shri R. K. {parts[1]}"
    return "Shri Rameshwar Soren"


def generate_applicant_document_pdf(document: Any, application: Any) -> bytes:
    """
    Generate an authentic PDF artifact for `document` matching `application`.
    Returns PDF binary bytes.
    """
    buffer = io.BytesIO()
    c = canvas.Canvas(buffer, pagesize=A4, pageCompression=0)
    width, height = A4

    doc_type = str(getattr(document, "doc_type", "")).lower()
    app_data = dict(getattr(application, "applicant_data", {}) or {})
    extracted = dict(getattr(document, "extracted_fields", {}) or {})
    applicant_name = getattr(application, "applicant_name", "Applicant")

    if "caste" in doc_type:
        _render_caste_certificate(c, width, height, applicant_name, app_data, extracted)
    elif "income" in doc_type:
        _render_income_certificate(c, width, height, applicant_name, app_data, extracted)
    elif "marksheet" in doc_type or "transcript" in doc_type:
        _render_marksheet(c, width, height, applicant_name, app_data, extracted)
    elif "bonafide" in doc_type:
        _render_bonafide_certificate(c, width, height, applicant_name, app_data, extracted)
    elif "admission" in doc_type:
        _render_admission_letter(c, width, height, applicant_name, app_data, extracted)
    elif "passport" in doc_type:
        _render_passport(c, width, height, applicant_name, app_data, extracted)
    else:
        _render_generic_document(c, width, height, applicant_name, doc_type, app_data, extracted)

    c.save()
    buffer.seek(0)
    return buffer.getvalue()


def _draw_ornate_border(c: canvas.Canvas, width: float, height: float, primary_color=colors.HexColor("#1e3a8a")):
    """Draw a clean official government double border."""
    c.setStrokeColor(primary_color)
    c.setLineWidth(2.5)
    c.rect(25, 25, width - 50, height - 50)
    c.setLineWidth(0.75)
    c.rect(30, 30, width - 60, height - 60)


def _draw_digital_sign_footer(c: canvas.Canvas, width: float, authority: str, date_str: str):
    """Draw official digital signature block and verification watermark."""
    # Digital sign box bottom right
    c.setStrokeColor(colors.HexColor("#059669"))
    c.setFillColor(colors.HexColor("#ecfdf5"))
    c.rect(width - 240, 45, 205, 65, fill=1, stroke=1)

    c.setFillColor(colors.HexColor("#065f46"))
    c.setFont("Helvetica-Bold", 8)
    c.drawString(width - 230, 95, "DIGITALLY SIGNED & VERIFIED")
    c.setFont("Helvetica", 7)
    c.drawString(width - 230, 83, f"Signatory: {authority[:30]}")
    c.drawString(width - 230, 72, f"Date: {date_str} IST")
    c.drawString(width - 230, 61, "National e-Governance Division (NeGD)")
    c.drawString(width - 230, 50, "Verification Hash: SHA256-OK-ePRAMAAN")

    # QR code placeholder box bottom left
    c.setStrokeColor(colors.HexColor("#9ca3af"))
    c.setFillColor(colors.HexColor("#f9fafb"))
    c.rect(35, 45, 65, 65, fill=1, stroke=1)
    c.setFillColor(colors.black)
    c.setFont("Helvetica", 6)
    c.drawCentredString(67, 75, "[ OFFICIAL QR ]")
    c.drawCentredString(67, 63, "Scan to Verify")
    c.drawCentredString(67, 52, "portal.gov.in")


# ── 1. CASTE CERTIFICATE ─────────────────────────────────────────────────────

def _render_caste_certificate(c: canvas.Canvas, width: float, height: float, name: str, app_data: dict, extracted: dict):
    _draw_ornate_border(c, width, height, colors.HexColor("#831843"))
    state = _get_applicant_state(app_data, default="JHARKHAND")
    cert_no = extracted.get("certificate_no") or f"ST/{state[:2]}/2024/{abs(hash(name)) % 9000 + 1000}"
    authority = extracted.get("issuing_authority") or "Sub-Divisional Officer & Magistrate"
    issue_date = extracted.get("issue_date") or "15-07-2024"
    tribe = app_data.get("tribe") or "Santhal"
    father = _get_father_name(name, app_data)
    district = app_data.get("district") or "Ranchi"

    # Header
    c.setFillColor(colors.HexColor("#831843"))
    c.setFont("Helvetica-Bold", 15)
    c.drawCentredString(width / 2, height - 60, f"GOVERNMENT OF {state}")
    c.setFont("Helvetica-Bold", 10)
    c.setFillColor(colors.HexColor("#374151"))
    c.drawCentredString(width / 2, height - 76, f"OFFICE OF THE DISTRICT MAGISTRATE / SUB-DIVISIONAL OFFICER, {district.upper()}")
    c.setFont("Helvetica", 9)
    c.drawCentredString(width / 2, height - 90, "DEPARTMENT OF REVENUE & TRIBAL WELFARE")

    c.setStrokeColor(colors.HexColor("#d1d5db"))
    c.setLineWidth(1)
    c.line(40, height - 100, width - 40, height - 100)

    # Title
    c.setFont("Helvetica-Bold", 13)
    c.setFillColor(colors.HexColor("#831843"))
    c.drawCentredString(width / 2, height - 125, "CASTE / TRIBE CERTIFICATE")
    c.setFont("Helvetica-Oblique", 8)
    c.setFillColor(colors.HexColor("#4b5563"))
    c.drawCentredString(width / 2, height - 138, "(Issued under the provisions of Article 342 of the Constitution of India)")

    # Cert Meta
    c.setFont("Helvetica-Bold", 9)
    c.setFillColor(colors.HexColor("#111827"))
    c.drawString(45, height - 165, f"Certificate No.: {cert_no}")
    c.drawString(width - 170, height - 165, f"Date of Issue: {issue_date}")

    # Body
    text_lines = [
        "This is to certify that:",
        f"Shri / Smt.  {name}",
        f"Son / Daughter of:  {father}",
        f"Resident of Village / Town:  {district} Sadar",
        f"District:  {district},   State:  {state}",
        "",
        f"belongs to the  '{tribe}'  community, which is recognized as a  SCHEDULED TRIBE (ST)",
        "under The Constitution (Scheduled Tribes) Order, 1950, as amended from time to time.",
        "",
        f"Shri/Smt. {name} and her/his family ordinarily reside(s) in District {district}",
        f"of the State of {state}.",
        "",
        "This certificate is issued on the basis of inquiry conducted by the competent Revenue Officers",
        "and verification of land records and local caste genealogy registers.",
    ]

    y = height - 200
    for line in text_lines:
        if line.startswith("Shri / Smt.") or "SCHEDULED TRIBE (ST)" in line:
            c.setFont("Helvetica-Bold", 11)
            c.setFillColor(colors.HexColor("#111827"))
        elif line.startswith("This is to certify"):
            c.setFont("Helvetica", 10)
            c.setFillColor(colors.HexColor("#374151"))
        else:
            c.setFont("Helvetica", 9.5)
            c.setFillColor(colors.HexColor("#1f2937"))
        c.drawString(45, y, line)
        y -= 22

    # Verification Note
    c.setFont("Helvetica-Bold", 8)
    c.setFillColor(colors.HexColor("#065f46"))
    c.drawString(45, 140, "Official Status: VALID & VERIFIED FOR CENTRAL/STATE SCHOLARSHIPS")
    c.setFont("Helvetica", 7.5)
    c.setFillColor(colors.HexColor("#6b7280"))
    c.drawString(45, 126, "Verified against National DigiLocker API & State Citizen Database.")

    _draw_digital_sign_footer(c, width, authority, issue_date)


# ── 2. INCOME CERTIFICATE ───────────────────────────────────────────────────

def _render_income_certificate(c: canvas.Canvas, width: float, height: float, name: str, app_data: dict, extracted: dict):
    _draw_ornate_border(c, width, height, colors.HexColor("#065f46"))
    state = _get_applicant_state(app_data, default="JHARKHAND")
    cert_no = extracted.get("certificate_no") or f"INC/{state[:2]}/2025/{abs(hash(name)) % 9000 + 1000}"
    authority = extracted.get("issuing_authority") or "Tehsildar / Executive Magistrate"
    issue_date = extracted.get("issue_date") or "20-05-2025"
    income = app_data.get("annual_income") or extracted.get("annual_income") or 410000
    father = _get_father_name(name, app_data)
    district = app_data.get("district") or "Ranchi"

    c.setFillColor(colors.HexColor("#065f46"))
    c.setFont("Helvetica-Bold", 15)
    c.drawCentredString(width / 2, height - 60, f"GOVERNMENT OF {state}")
    c.setFont("Helvetica-Bold", 10)
    c.setFillColor(colors.HexColor("#374151"))
    c.drawCentredString(width / 2, height - 76, f"REVENUE DEPARTMENT — OFFICE OF THE TEHSILDAR, {district.upper()}")
    c.setFont("Helvetica", 9)
    c.drawCentredString(width / 2, height - 90, "CERTIFICATE OF ANNUAL FAMILY INCOME")

    c.setStrokeColor(colors.HexColor("#d1d5db"))
    c.setLineWidth(1)
    c.line(40, height - 100, width - 40, height - 100)

    # Title
    c.setFont("Helvetica-Bold", 13)
    c.setFillColor(colors.HexColor("#065f46"))
    c.drawCentredString(width / 2, height - 125, "ANNUAL INCOME CERTIFICATE")

    # Meta
    c.setFont("Helvetica-Bold", 9)
    c.setFillColor(colors.HexColor("#111827"))
    c.drawString(45, height - 160, f"Certificate No: {cert_no}")
    c.drawString(width - 170, height - 160, f"Date of Issue: {issue_date}")

    lines = [
        "This is to certify that:",
        f"Name of Applicant:  {name}",
        f"Father's / Guardian's Name:  {father}",
        f"Address:  Village & Post {district} Rural, Tehsil {district}, District {district}, {state}",
        "",
        f"The total annual family income from all sources (agriculture, business, employment, etc.)",
        f"for the financial year 2024-2025 has been assessed at:",
        "",
        f"    INR {int(income):,}  (Rupees {int(income):,} Only)",
        "",
        "This certificate is issued exclusively for the purpose of availing Post-Matric & Higher Education",
        "Fellowship / Scholarship benefits sponsored by the Ministry of Tribal Affairs, Government of India.",
        "",
        "Validity: Valid for Financial Year 2025-2026 as per Revenue Norms.",
    ]

    y = height - 195
    for line in lines:
        if "INR" in line:
            c.setFont("Helvetica-Bold", 13)
            c.setFillColor(colors.HexColor("#065f46"))
        elif line.startswith("Name of Applicant"):
            c.setFont("Helvetica-Bold", 11)
            c.setFillColor(colors.HexColor("#111827"))
        else:
            c.setFont("Helvetica", 9.5)
            c.setFillColor(colors.HexColor("#1f2937"))
        c.drawString(45, y, line)
        y -= 22

    _draw_digital_sign_footer(c, width, authority, issue_date)


# ── 3. MARKSHEET ─────────────────────────────────────────────────────────────

def _render_marksheet(c: canvas.Canvas, width: float, height: float, name: str, app_data: dict, extracted: dict):
    _draw_ornate_border(c, width, height, colors.HexColor("#1e3a8a"))
    univ = app_data.get("university") or app_data.get("univ") or "Ranchi University"
    qualification = app_data.get("qualification") or "M.Phil / Post Graduate"
    percent = extracted.get("percentage") or app_data.get("qualifying_exam_percent") or 82.5

    c.setFillColor(colors.HexColor("#1e3a8a"))
    c.setFont("Helvetica-Bold", 15)
    c.drawCentredString(width / 2, height - 60, f"{univ.upper()}")
    c.setFont("Helvetica-Bold", 10)
    c.setFillColor(colors.HexColor("#374151"))
    c.drawCentredString(width / 2, height - 76, "OFFICE OF THE CONTROLLER OF EXAMINATIONS")
    c.setFont("Helvetica", 9)
    c.drawCentredString(width / 2, height - 90, "GRADE CARD & STATEMENT OF MARKS")

    c.setStrokeColor(colors.HexColor("#d1d5db"))
    c.setLineWidth(1)
    c.line(40, height - 100, width - 40, height - 100)

    c.setFont("Helvetica-Bold", 10)
    c.setFillColor(colors.HexColor("#111827"))
    c.drawString(45, height - 125, f"Candidate Name: {name}")
    c.drawString(width - 200, height - 125, f"Roll No: RU/2024/{abs(hash(name)) % 90000 + 10000}")
    c.drawString(45, height - 142, f"Degree / Program: {qualification}")
    c.drawString(width - 200, height - 142, "Passing Year: 2024")

    # Table of subjects
    subjects = [
        ("Advanced Research Methodology", "100", "84", "A+ (Excellent)"),
        ("Quantitative & Qualitative Analysis", "100", "81", "A  (Very Good)"),
        ("Tribal Studies, Customary Law & Governance", "100", "86", "A+ (Excellent)"),
        ("Dissertation / Research Seminar", "100", "82", "A  (Very Good)"),
        ("Comprehensive Viva Voce", "100", "79", "B+ (Good)"),
    ]

    y = height - 180
    c.setFillColor(colors.HexColor("#1e3a8a"))
    c.rect(45, y - 5, width - 90, 20, fill=1, stroke=0)
    c.setFillColor(colors.white)
    c.setFont("Helvetica-Bold", 9)
    c.drawString(55, y, "Subject / Paper Title")
    c.drawString(320, y, "Max")
    c.drawString(370, y, "Marks")
    c.drawString(430, y, "Grade Point")

    y -= 22
    total_marks = 0
    c.setFont("Helvetica", 8.5)
    for title, mx, obt, grade in subjects:
        c.setFillColor(colors.HexColor("#f3f4f6") if total_marks % 2 == 0 else colors.white)
        c.rect(45, y - 4, width - 90, 18, fill=1, stroke=0)
        c.setFillColor(colors.HexColor("#111827"))
        c.drawString(55, y, title)
        c.drawString(320, y, mx)
        c.drawString(370, y, obt)
        c.drawString(430, y, grade)
        total_marks += int(obt)
        y -= 20

    # Total row
    y -= 10
    c.setFont("Helvetica-Bold", 10)
    c.drawString(55, y, f"GRAND TOTAL: {total_marks} / 500    |    AGGREGATE PERCENTAGE: {percent}%")
    y -= 18
    c.setFont("Helvetica-Bold", 10)
    c.setFillColor(colors.HexColor("#065f46"))
    c.drawString(55, y, "RESULT: PASSED IN FIRST CLASS WITH DISTINCTION")

    _draw_digital_sign_footer(c, width, "Controller of Examinations", "18-08-2024")


# ── 4. BONAFIDE CERTIFICATE ──────────────────────────────────────────────────

def _render_bonafide_certificate(c: canvas.Canvas, width: float, height: float, name: str, app_data: dict, extracted: dict):
    _draw_ornate_border(c, width, height, colors.HexColor("#312e81"))
    univ = app_data.get("university") or app_data.get("univ") or "Ranchi University"
    qualification = app_data.get("qualification") or "M.Phil / Ph.D."

    c.setFillColor(colors.HexColor("#312e81"))
    c.setFont("Helvetica-Bold", 15)
    c.drawCentredString(width / 2, height - 60, f"{univ.upper()}")
    c.setFont("Helvetica-Bold", 10)
    c.setFillColor(colors.HexColor("#374151"))
    c.drawCentredString(width / 2, height - 76, "OFFICE OF THE REGISTRAR & DEAN OF RESEARCH")
    c.setFont("Helvetica-Bold", 13)
    c.setFillColor(colors.HexColor("#312e81"))
    c.drawCentredString(width / 2, height - 120, "BONAFIDE SCHOLAR CERTIFICATE")

    c.setStrokeColor(colors.HexColor("#d1d5db"))
    c.line(40, height - 95, width - 40, height - 95)

    c.setFont("Helvetica", 10)
    c.setFillColor(colors.HexColor("#111827"))
    lines = [
        f"Certificate Ref.: RU/BONAFIDE/2025-26/{abs(hash(name)) % 9000 + 1000}",
        f"Date: 02-09-2025",
        "",
        "TO WHOMSOEVER IT MAY CONCERN",
        "",
        f"This is to certify that Shri/Smt.  {name}",
        f"Son/Daughter of  {_get_father_name(name, app_data)}",
        f"is a bonafide, full-time enrolled regular research scholar/student in the",
        f"Department of Tribal Studies & Social Sciences at {univ}.",
        "",
        f"Enrolled Course / Degree:  {qualification}",
        "Current Academic Session:  2025-2026",
        "Enrollment / Registration No.:  REG-2024-ST-9912",
        "",
        "His/Her character and conduct in this institution have been found GOOD.",
        "This certificate is issued upon applicant request for the NFST Scholarship Portal.",
    ]

    y = height - 160
    for line in lines:
        if line.startswith("TO WHOMSOEVER"):
            c.setFont("Helvetica-Bold", 11)
            c.drawCentredString(width / 2, y, line)
        elif line.startswith("This is to certify that"):
            c.setFont("Helvetica-Bold", 10.5)
            c.drawString(45, y, line)
        else:
            c.setFont("Helvetica", 9.5)
            c.drawString(45, y, line)
        y -= 22

    _draw_digital_sign_footer(c, width, "Registrar / Dean of Academic Affairs", "02-09-2025")


# ── 5. ADMISSION LETTER ──────────────────────────────────────────────────────

def _render_admission_letter(c: canvas.Canvas, width: float, height: float, name: str, app_data: dict, extracted: dict):
    _draw_ornate_border(c, width, height, colors.HexColor("#1e293b"))
    univ = app_data.get("university_abroad") or "ETH Zurich / Top 500 QS Institution"
    course = app_data.get("course") or "Master of Science in Technology"

    c.setFillColor(colors.HexColor("#1e293b"))
    c.setFont("Helvetica-Bold", 15)
    c.drawCentredString(width / 2, height - 60, f"{univ.upper()}")
    c.setFont("Helvetica-Bold", 11)
    c.setFillColor(colors.HexColor("#059669"))
    c.drawCentredString(width / 2, height - 76, "OFFICIAL OFFER OF UNCONDITIONAL ADMISSION")

    c.setStrokeColor(colors.HexColor("#d1d5db"))
    c.line(40, height - 95, width - 40, height - 95)

    lines = [
        f"Dear {name},",
        "",
        f"We are pleased to inform you that following the review of your academic application,",
        f"the Admissions Committee has granted you UNCONDITIONAL ADMISSION to:",
        "",
        f"    Program: {course}",
        f"    Institution: {univ}",
        f"    Commencement: Autumn Semester 2026",
        "",
        "You have satisfied all academic and linguistic prerequisites for enrollment.",
        "This official letter serves as valid documentation for National Overseas Scholarship (NOS) sponsorship.",
    ]
    y = height - 140
    for line in lines:
        c.setFont("Helvetica-Bold" if "Program:" in line or "Dear" in line else "Helvetica", 10)
        c.drawString(45, y, line)
        y -= 22

    _draw_digital_sign_footer(c, width, "Head of Global Admissions", "10-06-2026")


# ── 6. PASSPORT ──────────────────────────────────────────────────────────────

def _render_passport(c: canvas.Canvas, width: float, height: float, name: str, app_data: dict, extracted: dict):
    _draw_ornate_border(c, width, height, colors.HexColor("#1e3a8a"))
    c.setFillColor(colors.HexColor("#1e3a8a"))
    c.setFont("Helvetica-Bold", 16)
    c.drawCentredString(width / 2, height - 60, "REPUBLIC OF INDIA / PASSPORT")
    c.setFont("Helvetica", 9)
    c.drawCentredString(width / 2, height - 76, "GOVERNMENT OF INDIA — MINISTRY OF EXTERNAL AFFAIRS")

    c.setStrokeColor(colors.HexColor("#d1d5db"))
    c.line(40, height - 95, width - 40, height - 95)

    c.setFont("Helvetica-Bold", 11)
    c.drawString(45, height - 130, f"SURNAME / GIVEN NAME: {name.upper()}")
    c.drawString(45, height - 150, "NATIONALITY: INDIAN")
    c.drawString(45, height - 170, f"PASSPORT NO: {extracted.get('passport_number', 'M6678129')}")
    c.drawString(45, height - 190, "DATE OF EXPIRY: 2034-04-18")

    _draw_digital_sign_footer(c, width, "Passport Issuing Officer", "18-04-2024")


# ── 7. GENERIC DOCUMENT FALLBACK ─────────────────────────────────────────────

def _render_generic_document(c: canvas.Canvas, width: float, height: float, name: str, doc_type: str, app_data: dict, extracted: dict):
    _draw_ornate_border(c, width, height, colors.HexColor("#374151"))
    title = doc_type.replace("_", " ").upper()
    c.setFont("Helvetica-Bold", 15)
    c.drawCentredString(width / 2, height - 60, "GOVERNMENT OF INDIA / MINISTRY OF TRIBAL AFFAIRS")
    c.setFont("Helvetica-Bold", 12)
    c.drawCentredString(width / 2, height - 85, f"DIGITAL DOCUMENT ARTIFACT: {title}")

    c.setStrokeColor(colors.HexColor("#d1d5db"))
    c.line(40, height - 100, width - 40, height - 100)

    c.setFont("Helvetica", 10)
    c.drawString(45, height - 140, f"Applicant: {name}")
    c.drawString(45, height - 160, f"Document Classification: {title}")
    c.drawString(45, height - 180, f"Verified On: {datetime.now(timezone.utc).strftime('%d-%m-%Y')}")

    _draw_digital_sign_footer(c, width, "Verified Officer", "Official Record")
