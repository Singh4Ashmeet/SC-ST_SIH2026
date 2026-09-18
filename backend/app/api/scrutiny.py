"""
Scrutiny API router.

Endpoints for document scrutiny, deficiency summaries, and resubmission.
"""

import uuid
from typing import Annotated, Any, Dict, List, Optional

from fastapi import APIRouter, Depends, File, Form, HTTPException, UploadFile, status
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.core.deps import (
    get_current_user,
    require_any_role,
    require_scrutiny_officer,
    require_applicant_or_any_role,
    require_applicant_or_scrutiny,
)
from app.models.application import Application
from app.models.audit_log import AuditLog
from app.models.document import Document, DocumentStatus
from app.models.scheme import Scheme
from app.models.user import User
from app.schemas.document import DocumentRead
from app.services.scheme_config_validator import validate_scheme_config
from app.services.document_processing_service import process_document
from app.services.storage_service import storage_service
from app.services.workflow_engine import WorkflowEngine, InvalidTransitionError

router = APIRouter(prefix="/applications", tags=["Scrutiny"])


def _get_doc_format_config(scheme: Scheme, doc_type: str) -> Optional[dict]:
    """Get the document format config for a specific doc_type."""
    config = validate_scheme_config(scheme.config)
    for doc in config.required_documents:
        if doc.doc_type == doc_type:
            return {
                "accepted_formats": doc.accepted_formats,
                "required": doc.required,
                "label": doc.label,
            }
    return None


def _validate_file_extension(filename: str, accepted_formats: List[str]) -> bool:
    """Check if file extension is in accepted formats."""
    if not filename or "." not in filename:
        return False
    ext = filename.split(".")[-1].lower()
    return ext in [fmt.lower() for fmt in accepted_formats]


@router.post(
    "/{application_id}/run-document-scrutiny",
    response_model=Dict[str, Any],
    status_code=status.HTTP_200_OK,
)
def run_document_scrutiny(
    application_id: uuid.UUID,
    current_user: Annotated[Optional[User], Depends(require_applicant_or_scrutiny)] = None,
    db: Session = Depends(get_db),
) -> Dict[str, Any]:
    """
    Trigger document scrutiny for an application.

    Runs deficiency checks on all documents and transitions the application
    to either 'selection' (if all verified) or 'deficient' (if any issues).

    Requires SCRUTINY_OFFICER or SUPER_ADMIN role.

    Returns:
        Updated application + full per-document deficiency breakdown
    """
    application = db.query(Application).filter(Application.id == application_id).first()
    if not application:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Application with id '{application_id}' not found",
        )

    engine = WorkflowEngine(db)

    try:
        updated_application = engine.run_document_scrutiny(application)
    except InvalidTransitionError as exc:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail={
                "error": "InvalidTransitionError",
                "message": str(exc),
                "current_state": exc.current_state,
                "trigger": exc.trigger,
                "allowed_roles": exc.allowed_roles,
            }
        ) from exc

    # Build per-document deficiency breakdown for response
    documents = db.query(Document).filter(Document.application_id == application_id).all()
    deficiency_breakdown = {}
    for doc in documents:
        deficiency_breakdown[str(doc.id)] = {
            "doc_type": doc.doc_type,
            "status": doc.status.value,
            "deficiency_reasons": doc.deficiency_reasons or [],
        }

    return {
        "application": updated_application,
        "deficiency_breakdown": deficiency_breakdown,
    }


@router.get(
    "/{application_id}/deficiency-summary",
    response_model=Dict[str, Any],
)
def get_deficiency_summary(
    application_id: uuid.UUID,
    current_user: Annotated[Optional[User], Depends(require_applicant_or_any_role)] = None,
    db: Session = Depends(get_db),
) -> Dict[str, Any]:
    """
    Get read-only view of current deficiency state across all documents.

    Does not trigger any state transitions. Any authenticated role or applicant portal can access.

    Returns:
        Per-document deficiency status and reasons
    """
    application = db.query(Application).filter(Application.id == application_id).first()
    if not application:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Application with id '{application_id}' not found",
        )

    documents = db.query(Document).filter(Document.application_id == application_id).all()

    # Check for missing required documents
    scheme = application.scheme
    if scheme:
        config = validate_scheme_config(scheme.config)
        uploaded_doc_types = {doc.doc_type for doc in documents}
        required_doc_types = {rd.doc_type for rd in config.required_documents if rd.required}
        missing_doc_types = required_doc_types - uploaded_doc_types
    else:
        missing_doc_types = set()

    deficiency_breakdown = {}
    for doc in documents:
        deficiency_breakdown[str(doc.id)] = {
            "doc_type": doc.doc_type,
            "status": doc.status.value,
            "deficiency_reasons": doc.deficiency_reasons or [],
        }

    return {
        "application_id": str(application_id),
        "current_state": application.current_state,
        "missing_documents": list(missing_doc_types),
        "documents": deficiency_breakdown,
    }


@router.post(
    "/{application_id}/documents/{document_id}/resubmit",
    response_model=Dict[str, Any],
    status_code=status.HTTP_200_OK,
)
async def resubmit_document(
    application_id: uuid.UUID,
    document_id: uuid.UUID,
    file: Annotated[UploadFile, File(...)],
    current_user: Annotated[Optional[User], Depends(require_applicant_or_any_role)] = None,
    db: Session = Depends(get_db),
) -> Dict[str, Any]:
    """
    Resubmit a replacement file for a specific deficient document.

    Uploads new file, re-runs OCR/extraction/deficiency check.
    If application is in 'deficient' state and ALL documents are now VERIFIED,
    auto-transitions via 'resubmitted' trigger.

    Requires any authenticated role (applicant can resubmit their own docs).

    Returns:
        Updated document + application state + whether auto-transition occurred
    """
    application = db.query(Application).filter(Application.id == application_id).first()
    if not application:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Application with id '{application_id}' not found",
        )

    document = db.query(Document).filter(Document.id == document_id).first()
    if not document:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Document with id '{document_id}' not found",
        )

    if document.application_id != application_id:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Document does not belong to this application",
        )

    # Validate doc_type is still allowed for this scheme
    scheme = application.scheme
    if not scheme:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Application has no associated scheme",
        )

    doc_format_config = _get_doc_format_config(scheme, document.doc_type)
    if not doc_format_config:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"doc_type '{document.doc_type}' is no longer valid for this scheme",
        )

    # Validate file extension
    if not _validate_file_extension(file.filename, doc_format_config["accepted_formats"]):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail={
                "error": "Invalid file extension",
                "message": f"File extension not allowed for doc_type '{document.doc_type}'",
                "accepted_formats": doc_format_config["accepted_formats"],
                "received_filename": file.filename,
            },
        )

    # Read file content
    file_bytes = await file.read()
    if not file_bytes:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Empty file not allowed",
        )

    # Generate new storage key
    storage_key = storage_service.generate_storage_key(
        application_id=application_id,
        doc_type=document.doc_type,
        original_filename=file.filename,
    )

    # Upload to MinIO
    try:
        storage_service.upload_file(
            file_bytes=file_bytes,
            key=storage_key,
            content_type=file.content_type or "application/octet-stream",
        )
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to upload file to storage: {str(e)}",
        )

    # Delete old file from storage (best effort)
    try:
        storage_service.delete_file(document.storage_key)
    except Exception:
        pass  # Ignore if old file doesn't exist

    # Update document with new storage key and reset status
    document.storage_key = storage_key
    document.content_type = file.content_type or "application/octet-stream"
    document.status = DocumentStatus.PENDING
    document.extracted_fields = None
    document.deficiency_reasons = None

    # Create audit log for resubmission
    audit_log = AuditLog(
        application_id=application_id,
        scheme_id=scheme.id,
        actor_user_id=current_user.id if current_user else None,
        action="document_resubmitted",
        details={
            "doc_type": document.doc_type,
            "old_storage_key": document.storage_key,
            "new_storage_key": storage_key,
            "original_filename": file.filename,
            "content_type": file.content_type,
            "file_size": len(file_bytes),
        },
    )
    db.add(audit_log)

    db.commit()
    db.refresh(document)

    # Re-process the document (OCR + extraction + deficiency check)
    process_document(db, document.id)
    db.refresh(document)

    # Check if application is in 'deficient' state and all docs are now VERIFIED
    auto_transitioned = False
    if application.current_state == "deficient":
        all_docs = db.query(Document).filter(Document.application_id == application_id).all()
        all_verified = all(doc.status == DocumentStatus.VERIFIED for doc in all_docs)

        if all_verified:
            engine = WorkflowEngine(db)
            try:
                application = engine.apply_transition(
                    application=application,
                    trigger="resubmitted",
                    actor_user_id=current_user.id if current_user else None,
                    details={"resubmitted_document_id": str(document_id)}
                )
                auto_transitioned = True
            except InvalidTransitionError:
                # Transition not allowed from current state, but that's ok
                pass

    # Generate presigned URL for response
    download_url = storage_service.get_presigned_url(document.storage_key)

    return {
        "document": DocumentRead(
            id=document.id,
            application_id=document.application_id,
            doc_type=document.doc_type,
            storage_key=document.storage_key,
            status=document.status,
            extracted_fields=document.extracted_fields,
            deficiency_reasons=document.deficiency_reasons,
            uploaded_at=document.uploaded_at,
            reviewed_at=document.reviewed_at,
            download_url=download_url,
        ),
        "application_state": application.current_state,
        "auto_transitioned": auto_transitioned,
    }