"""
Document processing service for OCR and field extraction pipeline.
"""

import logging
import uuid
from typing import Dict, Any, Optional

from sqlalchemy.orm import Session

from app.models.document import Document, DocumentStatus
from app.models.application import Application
from app.services.storage_service import storage_service
from app.services.ocr_service import extract_text
from app.services.field_extraction_service import extract_fields
from app.services.deficiency_service import check_document, DeficiencyCheck
from app.models.scheme import Scheme
from app.schemas.scheme_config import SchemeConfig
from app.services.scheme_config_validator import validate_scheme_config

logger = logging.getLogger(__name__)


def process_document(db: Session, document_id: uuid.UUID) -> Dict[str, Any]:
    """
    Process a document: download, OCR, extract fields, check deficiencies, and save results.

    Args:
        db: Database session
        document_id: UUID of the document to process

    Returns:
        Dictionary with extracted_fields and any error info
    """
    # Load the document
    document = db.query(Document).filter(Document.id == document_id).first()
    if not document:
        logger.error(f"Document not found: {document_id}")
        return {"error": "Document not found", "extracted_fields": {}}

    # Download file from storage
    try:
        file_bytes = storage_service.download_file(document.storage_key)
        if not file_bytes:
            logger.warning(f"Empty file downloaded for document {document_id}")
            return {"error": "Empty file", "extracted_fields": {}}
    except Exception as e:
        logger.error(f"Failed to download file for document {document_id}: {e}")
        return {"error": f"Failed to download file: {e}", "extracted_fields": {}}

    # Extract text via OCR
    try:
        raw_text = extract_text(file_bytes, document.content_type or "application/octet-stream")
        if not raw_text.strip():
            logger.warning(f"OCR returned empty text for document {document_id}")
    except Exception as e:
        logger.error(f"OCR failed for document {document_id}: {e}")
        raw_text = ""

    # Extract structured fields
    try:
        extracted = extract_fields(raw_text, document.doc_type)
    except Exception as e:
        logger.error(f"Field extraction failed for document {document_id}: {e}")
        extracted = {}

    # Save results to document
    # Store raw_text in extracted_fields under _raw_text key
    if document.extracted_fields is None:
        document.extracted_fields = {}

    document.extracted_fields["_raw_text"] = raw_text
    document.extracted_fields.update(extracted)

# Run deficiency check
    try:
        # Get scheme config for deficiency checking
        application = db.query(Application).filter(Application.id == document.application_id).first()
        if application and application.scheme:
            scheme_config = validate_scheme_config(application.scheme.config)
            deficiency_check = check_document(document, scheme_config)

            # Update document status and deficiency reasons
            document.deficiency_reasons = deficiency_check.reasons
            if deficiency_check.is_deficient:
                document.status = DocumentStatus.DEFICIENT
            else:
                document.status = DocumentStatus.VERIFIED
        else:
            logger.warning(f"No scheme found for document {document_id}, skipping deficiency check")

    except Exception as e:
        logger.error(f"Deficiency check failed for document {document_id}: {e}")

    db.commit()
    db.refresh(document)

    logger.info(f"Processed document {document_id}: extracted {len(extracted)} fields")

    return {
        "extracted_fields": document.extracted_fields,
        "raw_text": raw_text,
    }


def get_processed_fields(document: Document) -> Dict[str, Any]:
    """
    Get the processed extracted fields from a document.

    Returns empty dict if not yet processed.
    """
    if not document.extracted_fields:
        return {}
    # Return all fields except _raw_text (for API responses)
    return {k: v for k, v in document.extracted_fields.items() if k != "_raw_text"}