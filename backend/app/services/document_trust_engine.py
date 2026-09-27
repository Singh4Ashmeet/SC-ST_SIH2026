"""
Document Trust Engine & Evidence Consistency Graph.

Yojana Setu (SIH26239) — Ministry of Tribal Affairs
Provides explainable, multi-signal document assessment and cross-document evidence verification.
Replaces black-box 'fraud scores' with transparent evidence reasoning for human scrutiny officers.
"""

import re
from datetime import datetime, timedelta
from typing import Any, Dict, List, Optional
from difflib import SequenceMatcher


def _clean_str(val: Any) -> str:
    if val is None:
        return ""
    if isinstance(val, dict) and "value" in val:
        return str(val["value"]).strip()
    return str(val).strip()


def _string_similarity(a: str, b: str) -> float:
    if not a or not b:
        return 0.0
    return SequenceMatcher(None, a.lower().strip(), b.lower().strip()).ratio()


def _parse_date(date_str: str) -> Optional[datetime]:
    if not date_str:
        return None
    patterns = [
        r"^(\d{4})-(\d{2})-(\d{2})$",
        r"^(\d{2})/(\d{2})/(\d{4})$",
        r"^(\d{2})-(\d{2})-(\d{4})$",
    ]
    for pat in patterns:
        m = re.match(pat, date_str.strip())
        if m:
            parts = m.groups()
            try:
                if len(parts[0]) == 4:
                    return datetime(int(parts[0]), int(parts[1]), int(parts[2]))
                return datetime(int(parts[2]), int(parts[1]), int(parts[0]))
            except ValueError:
                continue
    return None


def evaluate_document_trust(
    document: Any,
    application: Optional[Any],
    scheme_config: Optional[Any] = None,
    all_documents: Optional[List[Any]] = None,
) -> Dict[str, Any]:
    """
    Evaluates multi-signal trust indicators for an uploaded document.
    Produces an explainable checklist with clear reasons rather than a synthetic score.
    """
    extracted = document.extracted_fields or {}
    raw_text = extracted.get("_raw_text", "")
    signals: Dict[str, Any] = {}
    reasons: List[str] = []

    # 1. OCR Quality
    text_len = len(raw_text.strip())
    extracted_keys = [k for k in extracted.keys() if not k.startswith("_")]
    if text_len > 150 or (not raw_text and len(extracted_keys) >= 3):
        ocr_quality = "GOOD"
    elif text_len > 40 or (not raw_text and len(extracted_keys) >= 1):
        ocr_quality = "MODERATE"
    else:
        ocr_quality = "LOW"

    display_len = text_len if text_len > 0 else (len(extracted_keys) * 35)
    signals["ocr_quality"] = {
        "status": ocr_quality,
        "label": f"{ocr_quality} ({display_len} characters equivalent)",
        "pass": ocr_quality in ["GOOD", "MODERATE"],
    }

    # 2. Document Type Match & Visual Deep Learning Classification
    classification = extracted.get("_doc_classification")
    if classification and isinstance(classification, dict):
        pred_class = classification.get("predicted_class")
        conf = classification.get("confidence", 0.0)
        is_match = classification.get("is_match_with_claimed_type", True)
        signals["visual_classifier"] = {
            "model": classification.get("model_name", "EfficientNet-B0 (document_classifier_final.pt)"),
            "predicted_class": pred_class,
            "confidence": conf,
            "pass": is_match,
            "label": f"Deep Learning Verdict: {pred_class} ({int(conf * 100)}% visual match)" if pred_class else "Deep Learning Classification Verified",
        }

    if text_len > 100 and len(extracted_keys) < 2:
        doc_type_match = "MISMATCH"
        reasons.append("Document text does not match expected structure for this certificate type.")
    else:
        doc_type_match = "MATCH"
    signals["document_type"] = {
        "status": doc_type_match,
        "label": "MATCH" if doc_type_match == "MATCH" else "POSSIBLE WRONG DOCUMENT",
        "pass": doc_type_match == "MATCH",
    }

    # 3. Applicant Name Consistency
    applicant_name = getattr(application, "applicant_name", "") if application else ""
    doc_name = (
        _clean_str(extracted.get("applicant_name"))
        or _clean_str(extracted.get("student_name"))
        or _clean_str(extracted.get("full_name"))
        or _clean_str(extracted.get("name"))
    )

    if applicant_name and doc_name:
        sim = _string_similarity(applicant_name, doc_name)
        if sim >= 0.70:
            name_status = "MATCH"
        else:
            name_status = "MISMATCH"
            reasons.append(f"Applicant name '{applicant_name}' differs from document name '{doc_name}'.")
    elif doc_name:
        name_status = "EXTRACTED"
    else:
        name_status = "NOT_FOUND"
        reasons.append("Applicant name could not be identified in the document.")

    signals["applicant_name"] = {
        "status": name_status,
        "value": doc_name or "Not detected",
        "pass": name_status in ["MATCH", "EXTRACTED"],
    }

    # 4. Annual Income / Financial Consistency (for income certificates)
    if "income" in document.doc_type.lower():
        declared_income = None
        if application and hasattr(application, "applicant_data") and application.applicant_data:
            declared_income = application.applicant_data.get("annual_income")
        doc_income = _clean_str(extracted.get("annual_income"))
        if declared_income is not None and doc_income:
            try:
                dec_num = float(str(declared_income).replace(",", ""))
                doc_num = float(doc_income.replace(",", ""))
                if abs(dec_num - doc_num) < 1.0:
                    inc_status = "MATCH"
                else:
                    inc_status = "MISMATCH"
                    reasons.append(f"Declared income (₹{dec_num:,.0f}) does not match certificate value (₹{doc_num:,.0f}).")
            except ValueError:
                inc_status = "EXTRACTED"
        else:
            inc_status = "EXTRACTED" if doc_income else "MISSING"

        signals["annual_income"] = {
            "status": inc_status,
            "value": f"₹{doc_income}" if doc_income else "Not detected",
            "pass": inc_status in ["MATCH", "EXTRACTED"],
        }

    # 5. Issue Date & Validity Period
    issue_date_str = (
        _clean_str(extracted.get("issue_date"))
        or _clean_str(extracted.get("admission_date"))
        or _clean_str(extracted.get("test_date"))
    )
    if issue_date_str:
        parsed_dt = _parse_date(issue_date_str)
        if parsed_dt:
            # Default 365 days unless specified in required_documents
            validity_days = 365
            if scheme_config and hasattr(scheme_config, "required_documents"):
                for rd in scheme_config.required_documents:
                    if getattr(rd, "doc_type", "") == document.doc_type and getattr(rd, "validity_days", None):
                        validity_days = rd.validity_days
                        break

            cutoff_date = datetime.now() - timedelta(days=validity_days)
            if parsed_dt < cutoff_date:
                validity_status = "OUTSIDE_VALIDITY"
                reasons.append(f"Certificate issue date ({parsed_dt.strftime('%d-%m-%Y')}) exceeds scheme validity window of {validity_days} days.")
            else:
                validity_status = "VALID"
        else:
            validity_status = "UNRECOGNIZED_FORMAT"
            reasons.append(f"Issue date '{issue_date_str}' is in an unrecognized date format.")
    else:
        validity_status = "NOT_DETECTED"
        if document.doc_type in ["income_certificate", "admission_letter"]:
            reasons.append("Issue date is missing on certificate.")

    signals["validity_period"] = {
        "status": validity_status,
        "value": issue_date_str or "Not detected",
        "pass": validity_status in ["VALID", "NOT_DETECTED"],
    }

    # 6. Issuing Authority Presence
    authority_val = (
        _clean_str(extracted.get("issuing_authority"))
        or _clean_str(extracted.get("board_or_university"))
        or _clean_str(extracted.get("institution_name"))
        or _clean_str(extracted.get("university"))
    )
    if authority_val:
        auth_status = "FOUND"
    else:
        auth_status = "NOT_DETECTED"
        if document.doc_type in ["caste_certificate", "income_certificate"]:
            reasons.append("Competent issuing authority seal or signatory not identified.")

    signals["issuing_authority"] = {
        "status": auth_status,
        "value": authority_val or "Not detected",
        "pass": auth_status == "FOUND",
    }

    # 7. Duplicate File Detection across all application documents
    is_duplicate = False
    if all_documents:
        for other in all_documents:
            if str(other.id) != str(document.id):
                if getattr(other, "storage_key", None) == getattr(document, "storage_key", None):
                    is_duplicate = True
                    reasons.append("Exact duplicate document file detected.")
                    break

    signals["duplicate_check"] = {
        "status": "DUPLICATE_FOUND" if is_duplicate else "UNIQUE",
        "label": "DUPLICATE FOUND" if is_duplicate else "NOT FOUND",
        "pass": not is_duplicate,
    }

    # Overall Decision
    has_critical_failure = (
        doc_type_match == "MISMATCH"
        or is_duplicate
        or name_status == "MISMATCH"
        or validity_status == "OUTSIDE_VALIDITY"
        or (signals.get("annual_income") and signals["annual_income"]["status"] == "MISMATCH")
    )

    if has_critical_failure:
        decision = "REVIEW_REQUIRED"
    elif reasons:
        decision = "NEEDS_SCRUTINY"
    else:
        decision = "VERIFIED"

    # Field confidence extraction & continuous document-level confidence calculation
    field_confidences: Dict[str, float] = {}
    for k, v in extracted.items():
        if not k.startswith("_"):
            if isinstance(v, dict) and "confidence" in v:
                conf_val = v["confidence"]
                if isinstance(conf_val, (int, float)):
                    field_confidences[k] = float(conf_val)
                elif conf_val == "high":
                    field_confidences[k] = 0.95
                elif conf_val == "medium":
                    field_confidences[k] = 0.80
                else:
                    field_confidences[k] = 0.60
            elif v is not None and str(v).strip():
                field_confidences[k] = 0.85

    field_conf_avg = (sum(field_confidences.values()) / len(field_confidences)) if field_confidences else 0.80
    signal_pass_count = sum(1 for s in signals.values() if s.get("pass", False))
    signal_ratio = signal_pass_count / max(len(signals), 1)
    ocr_quality_conf = 0.95 if ocr_quality == "GOOD" else (0.75 if ocr_quality == "MODERATE" else 0.40)

    # Calculate real continuous document confidence (0.0 to 1.0)
    calculated_doc_confidence = round(0.40 * signal_ratio + 0.40 * field_conf_avg + 0.20 * ocr_quality_conf, 2)
    if has_critical_failure:
        calculated_doc_confidence = min(calculated_doc_confidence, 0.45)

    # Uncertainty-Aware Routing Thresholds (configurable via scheme_config if provided)
    auto_verify_thresh = 0.90
    human_review_thresh = 0.70
    if scheme_config and hasattr(scheme_config, "trust_thresholds"):
        auto_verify_thresh = getattr(scheme_config.trust_thresholds, "auto_verify", 0.90)
        human_review_thresh = getattr(scheme_config.trust_thresholds, "human_review", 0.70)
    elif scheme_config and isinstance(scheme_config, dict) and "trust_thresholds" in scheme_config:
        auto_verify_thresh = scheme_config["trust_thresholds"].get("auto_verify", 0.90)
        human_review_thresh = scheme_config["trust_thresholds"].get("human_review", 0.70)

    if calculated_doc_confidence >= auto_verify_thresh and not has_critical_failure and not reasons:
        review_routing = "AUTO_VERIFY"
        routing_explanation = f"Confidence {calculated_doc_confidence * 100:.0f}% meets/exceeds {auto_verify_thresh * 100:.0f}% policy threshold with all trust signals verified."
    elif calculated_doc_confidence >= human_review_thresh and not has_critical_failure:
        review_routing = "HUMAN_REVIEW_RECOMMENDED"
        routing_explanation = f"Confidence {calculated_doc_confidence * 100:.0f}% is within advisory review window ({human_review_thresh * 100:.0f}% - {auto_verify_thresh * 100:.0f}%). Human verification suggested."
    else:
        review_routing = "MANDATORY_HUMAN_REVIEW"
        reasons_summary = "; ".join(reasons) if reasons else "Confidence below required policy threshold."
        routing_explanation = f"Confidence {calculated_doc_confidence * 100:.0f}% is below {human_review_thresh * 100:.0f}% policy threshold or critical trust failure detected: {reasons_summary}"

    trust_score = int(calculated_doc_confidence * 100)
    signals_list = [
        {"name": "Document Type Confidence", "status": "PASS" if doc_type_match == "MATCH" else "WARN", "message": doc_type_match},
        {"name": "Applicant Name Consistency", "status": "PASS" if name_status == "MATCH" else "WARN", "message": name_status},
        {"name": "Annual Income Extraction", "status": "PASS" if (not signals.get("annual_income") or signals["annual_income"]["status"] == "MATCH") else "WARN", "message": "Income extraction"},
        {"name": "Date Validity Window", "status": "PASS" if validity_status == "VALID" else ("WARN" if validity_status == "NOT_DETECTED" else "FAIL"), "message": validity_status},
        {"name": "Issuing Authority Presence", "status": "PASS" if auth_status == "FOUND" else "WARN", "message": auth_status},
        {"name": "Duplicate File Check", "status": "PASS" if not is_duplicate else "FAIL", "message": "Duplicate detected" if is_duplicate else "Unique"},
    ]

    return {
        "doc_id": str(document.id),
        "doc_type": document.doc_type,
        "decision": decision,
        "overall_trust_status": decision,
        "trust_score": trust_score,
        "document_confidence": calculated_doc_confidence,
        "field_confidence": field_confidences,
        "review_routing": review_routing,
        "routing_explanation": routing_explanation,
        "thresholds_applied": {
            "auto_verify": auto_verify_thresh,
            "human_review": human_review_thresh,
        },
        "signals": signals_list,
        "raw_signals": signals,
        "reasons": reasons,
        "explanation": "; ".join(reasons) if reasons else "All document trust signals verified successfully.",
        "is_trustworthy": decision == "VERIFIED",
    }



def build_evidence_graph(application: Any, documents: List[Any]) -> Dict[str, Any]:
    """
    Constructs an evidence relationship graph connecting application declared values
    with extracted fields from all uploaded documentary evidence.
    Identifies cross-document consistency anomalies for scrutiny officers.
    """
    applicant_data = getattr(application, "applicant_data", {}) or {}
    declared_name = getattr(application, "applicant_name", "")

    evidence_nodes: List[Dict[str, Any]] = []
    cross_comparisons: List[Dict[str, Any]] = []

    names_found: Dict[str, str] = {}
    incomes_found: Dict[str, str] = {}

    for doc in documents:
        extracted = getattr(doc, "extracted_fields", {}) or {}
        doc_label = getattr(doc, "doc_type", "").replace("_", " ").title()

        doc_name = (
            _clean_str(extracted.get("applicant_name"))
            or _clean_str(extracted.get("student_name"))
            or _clean_str(extracted.get("full_name"))
            or _clean_str(extracted.get("name"))
        )
        if doc_name:
            names_found[doc.doc_type] = doc_name

        doc_income = _clean_str(extracted.get("annual_income"))
        if doc_income:
            incomes_found[doc.doc_type] = doc_income

        evidence_nodes.append({
            "id": str(doc.id),
            "doc_type": doc.doc_type,
            "label": doc_label,
            "status": str(getattr(doc, "status", "PENDING")),
            "extracted": {k: _clean_str(v) for k, v in extracted.items() if not k.startswith("_")},
        })

    # Cross-document Name Consistency Analysis
    if declared_name:
        for dtype, name in names_found.items():
            match = _string_similarity(declared_name, name) >= 0.75
            cross_comparisons.append({
                "field": "Applicant Name",
                "source_a": "Application Record",
                "source_b": dtype.replace("_", " ").title(),
                "val_a": declared_name,
                "val_b": name,
                "status": "PASS" if match else "DISCREPANCY",
                "message": "Names match consistently" if match else f"Name variation: '{declared_name}' vs '{name}'",
            })

    # Cross-document Income Consistency Analysis
    declared_income = str(applicant_data.get("annual_income", ""))
    if declared_income and incomes_found:
        for dtype, inc in incomes_found.items():
            try:
                m = abs(float(declared_income.replace(",", "")) - float(inc.replace(",", ""))) < 1.0
            except ValueError:
                m = False
            cross_comparisons.append({
                "field": "Annual Income",
                "source_a": "Application Record",
                "source_b": dtype.replace("_", " ").title(),
                "val_a": f"₹{declared_income}",
                "val_b": f"₹{inc}",
                "status": "PASS" if m else "DISCREPANCY",
                "message": "Declared income matches certificate" if m else "Income certificate amount differs from application",
            })

    discrepancy_count = sum(1 for c in cross_comparisons if c["status"] == "DISCREPANCY")
    total_comparisons = len(cross_comparisons)
    passed_comparisons = sum(1 for c in cross_comparisons if c["status"] == "PASS")
    cross_doc_confidence = round(passed_comparisons / max(total_comparisons, 1), 2) if total_comparisons > 0 else 1.0

    return {
        "application_id": str(application.id),
        "applicant_name": declared_name,
        "evidence_nodes": evidence_nodes,
        "cross_comparisons": cross_comparisons,
        "total_anomalies": discrepancy_count,
        "cross_document_confidence": cross_doc_confidence,
        "overall_evidence_integrity": "PASS" if discrepancy_count == 0 else "REVIEW_REQUIRED",
        "consistency_verdict": "PASS" if discrepancy_count == 0 else "WARNING",
        "anomalies": [c["message"] for c in cross_comparisons if c["status"] == "DISCREPANCY"],
        "summary": "All extracted entities match consistently across uploaded certificates." if discrepancy_count == 0 else f"{discrepancy_count} discrepancy detected in supporting evidence.",
    }

