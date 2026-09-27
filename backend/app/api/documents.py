"""
Documents API router.

Endpoints for uploading, listing, retrieving, and deleting documents
attached to applications.
"""

import uuid
from typing import Annotated, List, Optional

from fastapi import APIRouter, Depends, File, Form, HTTPException, Query, Response, UploadFile, status
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.core.deps import get_current_user, get_optional_current_user, require_any_role, require_scrutiny_officer
from app.models.application import Application
from app.models.audit_log import AuditLog
from app.models.document import Document, DocumentStatus
from app.models.scheme import Scheme
from app.models.user import User
from app.schemas.document import DocumentRead
from app.services.storage_service import storage_service
from app.services.scheme_config_validator import validate_scheme_config
from app.services.document_processing_service import process_document
from app.services.deficiency_service import check_application_documents
from app.services.workflow_engine import WorkflowEngine

router = APIRouter(prefix="/applications", tags=["Documents"])


def _get_scheme_allowed_doc_types(scheme: Scheme) -> set:
    """Extract allowed doc_types from scheme config."""
    config = validate_scheme_config(scheme.config)
    return {doc.doc_type for doc in config.required_documents}


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


# Intentionally unauthenticated: applicant self-service document upload.
# Access control is via the unguessable applicationId in the URL,
# per the plan's stated hackathon-scope limitation.
@router.post(
    "/{application_id}/documents",
    response_model=DocumentRead,
    status_code=status.HTTP_201_CREATED,
)
async def upload_document(
    application_id: uuid.UUID,
    doc_type: Annotated[str, Form(...)],
    file: Annotated[UploadFile, File(...)],
    current_user: Annotated[Optional[User], Depends(get_optional_current_user)] = None,
    db: Session = Depends(get_db),
) -> DocumentRead:
    """
    Upload a document for an application.
    Enforces applicant ownership or administrative document upload permission.
    """
    # Get application
    application = db.query(Application).filter(Application.id == application_id).first()
    if not application:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Application with id '{application_id}' not found",
        )

    from app.core.authorization import verify_applicant_ownership_or_permission
    from app.core.permissions import Permission
    verify_applicant_ownership_or_permission(current_user, application, Permission.DOCUMENT_UPLOAD)

    # Get scheme config
    scheme = application.scheme
    if not scheme:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Application has no associated scheme",
        )

    # Validate doc_type exists in scheme config
    doc_format_config = _get_doc_format_config(scheme, doc_type)
    if not doc_format_config:
        allowed_types = _get_scheme_allowed_doc_types(scheme)
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail={
                "error": "Invalid doc_type",
                "message": f"doc_type '{doc_type}' is not defined in the scheme's required_documents",
                "allowed_doc_types": list(allowed_types),
            },
        )

    # Validate file extension
    if not _validate_file_extension(file.filename, doc_format_config["accepted_formats"]):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail={
                "error": "Invalid file extension",
                "message": f"File extension not allowed for doc_type '{doc_type}'",
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

    # Generate storage key
    storage_key = storage_service.generate_storage_key(
        application_id=application_id,
        doc_type=doc_type,
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

    # Check if a document with this doc_type already exists for this application
    existing_docs = db.query(Document).filter(
        Document.application_id == application_id,
        Document.doc_type == doc_type
    ).order_by(Document.uploaded_at.desc()).all()

    if existing_docs:
        document = existing_docs[0]
        document.storage_key = storage_key
        document.status = DocumentStatus.PENDING
        document.content_type = file.content_type or "application/octet-stream"
        document.extracted_fields = None
        document.deficiency_reasons = None
        document.reviewed_at = None
        for old_dup in existing_docs[1:]:
            db.delete(old_dup)
    else:
        document = Document(
            application_id=application_id,
            doc_type=doc_type,
            storage_key=storage_key,
            status=DocumentStatus.PENDING,
            content_type=file.content_type or "application/octet-stream",
        )
        db.add(document)
    db.flush()

    # Create audit log with cryptographic hash chain
    from app.services.audit_service import create_audit_log
    create_audit_log(
        db=db,
        application_id=application_id,
        scheme_id=scheme.id,
        actor_user_id=None,
        action="document_uploaded",
        details={
            "doc_type": doc_type,
            "storage_key": storage_key,
            "original_filename": file.filename,
            "content_type": file.content_type,
            "file_size": len(file_bytes),
        },
    )

    db.commit()
    db.refresh(document)

    # Trigger synchronous OCR processing (pass in-memory file_bytes to eliminate download latency)
    processing_result = process_document(db, document.id, file_bytes=file_bytes)

    # Refresh document to get updated extracted_fields
    db.refresh(document)

    # Generate presigned URL for response
    download_url = storage_service.get_presigned_url(document.storage_key)

    # Build response with extracted fields
    return DocumentRead(
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
    )


# Intentionally unauthenticated: applicant self-service document listing.
# Access control is via the unguessable applicationId in the URL,
# per the plan's stated hackathon-scope limitation.
@router.get(
    "/{application_id}/documents",
    response_model=List[DocumentRead],
)
def list_documents(
    application_id: uuid.UUID,
    db: Session = Depends(get_db),
) -> List[DocumentRead]:
    """
    List all documents for an application with presigned download URLs.
    """
    # Verify application exists
    application = db.query(Application).filter(Application.id == application_id).first()
    if not application:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Application with id '{application_id}' not found",
        )

    raw_documents = db.query(Document).filter(Document.application_id == application_id).order_by(Document.uploaded_at.desc()).all()

    # Deduplicate so only the canonical/latest document per doc_type is returned
    seen_types = set()
    documents = []
    for doc in raw_documents:
        if doc.doc_type not in seen_types:
            seen_types.add(doc.doc_type)
            documents.append(doc)
    documents.reverse()

    result = []
    for doc in documents:
        download_url = storage_service.get_presigned_url(doc.storage_key)
        result.append(DocumentRead(
            id=doc.id,
            application_id=doc.application_id,
            doc_type=doc.doc_type,
            storage_key=doc.storage_key,
            status=doc.status,
            extracted_fields=doc.extracted_fields,
            deficiency_reasons=doc.deficiency_reasons,
            uploaded_at=doc.uploaded_at,
            reviewed_at=doc.reviewed_at,
            download_url=download_url,
        ))

    return result


@router.get(
    "/documents/{document_id}",
    response_model=DocumentRead,
)
def get_document(
    document_id: uuid.UUID,
    current_user: Annotated[User, Depends(require_any_role)],
    db: Session = Depends(get_db),
) -> DocumentRead:
    """
    Fetch a single document's metadata with presigned download URL.
    """
    document = db.query(Document).filter(Document.id == document_id).first()
    if not document:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Document with id '{document_id}' not found",
        )

    download_url = storage_service.get_presigned_url(document.storage_key)

    return DocumentRead(
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
    )


@router.get(
    "/{application_id}/documents/{document_id}/trust-assessment",
)
def get_document_trust_assessment(
    application_id: uuid.UUID,
    document_id: uuid.UUID,
    current_user: Annotated[Optional[User], Depends(get_optional_current_user)] = None,
    db: Session = Depends(get_db),
):
    """
    Get explainable multi-signal Document Trust Assessment (field completeness, authority, validity, duplicate check).
    """
    document = db.query(Document).filter(Document.id == document_id, Document.application_id == application_id).first()
    if not document:
        raise HTTPException(status_code=404, detail="Document not found")

    application = document.application
    if current_user and application:
        from app.core.authorization import is_user_authorized_for_application
        if not is_user_authorized_for_application(current_user, application):
            raise HTTPException(status_code=403, detail="Access denied")

    all_docs = db.query(Document).filter(Document.application_id == application_id).all()
    scheme_config = None
    if application and application.scheme:
        from app.services.scheme_config_validator import validate_scheme_config
        scheme_config = validate_scheme_config(application.scheme.config)

    from app.services.document_trust_engine import evaluate_document_trust
    return evaluate_document_trust(document, application, scheme_config, all_docs)



@router.get("/documents/{document_id}/file")
@router.get("/{application_id}/documents/{document_id}/file")
def get_document_file(
    document_id: uuid.UUID,
    application_id: Optional[uuid.UUID] = None,
    current_user: Annotated[Optional[User], Depends(get_optional_current_user)] = None,
    db: Session = Depends(get_db),
) -> Response:
    """
    Stream a document file securely for inline preview or download.

    Supports PDF, PNG, JPG/JPEG.
    Enforces role/ownership authorization and private no-store headers for confidential records.
    """
    document = db.query(Document).filter(Document.id == document_id).first()
    if not document:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Document with id '{document_id}' not found",
        )

    if application_id and document.application_id != application_id:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Document does not belong to the specified application",
        )

    # Enforce role / ownership access control
    application = db.query(Application).filter(Application.id == document.application_id).first()
    if application:
        from app.core.authorization import verify_document_access
        from app.core.permissions import Permission
        verify_document_access(current_user, document, application, Permission.DOCUMENT_VIEW)

    file_bytes = None
    # 1. Check if exact file exists in storage for this application
    if storage_service.has_exact_key(document.storage_key):
        try:
            file_bytes = storage_service.download_exact(document.storage_key)
        except Exception:
            pass

    # 2. If exact file is not in storage, dynamically generate official certificate for THIS applicant
    if not file_bytes and application:
        try:
            from app.services.document_pdf_generator import generate_applicant_document_pdf
            file_bytes = generate_applicant_document_pdf(document, application)
            # Cache it in storage for this application
            if file_bytes:
                try:
                    storage_service.upload_file(file_bytes, document.storage_key, "application/pdf")
                except Exception:
                    pass
        except Exception as gen_err:
            pass

    # 3. Fallback to storage_service.download_file
    if not file_bytes:
        try:
            file_bytes = storage_service.download_file(document.storage_key)
        except Exception:
            pass

    if not file_bytes:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Document preview unavailable.",
        )

    media_type = document.content_type or "application/pdf"
    if "pdf" in document.storage_key.lower():
        media_type = "application/pdf"
    elif "png" in document.storage_key.lower():
        media_type = "image/png"
    elif "jpg" in document.storage_key.lower() or "jpeg" in document.storage_key.lower():
        media_type = "image/jpeg"

    return Response(
        content=file_bytes,
        media_type=media_type,
        headers={
            "Content-Disposition": f'inline; filename="{document.doc_type}_{document.id}.pdf"',
            "Cache-Control": "private, no-cache, no-store, must-revalidate",
            "Pragma": "no-cache",
            "Expires": "0",
            "X-Content-Type-Options": "nosniff",
        },
    )



@router.delete(
    "/documents/{document_id}",
    status_code=status.HTTP_204_NO_CONTENT,
)
def delete_document(
    document_id: uuid.UUID,
    current_user: Annotated[User, Depends(require_scrutiny_officer)],
    db: Session = Depends(get_db),
) -> None:
    """
    Delete a document from storage and database.

    Requires SUPER_ADMIN or SCRUTINY_OFFICER role.
    Removes file from MinIO and deletes Document row.
    Writes AuditLog row (action="document_deleted").
    """
    document = db.query(Document).filter(Document.id == document_id).first()
    if not document:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Document with id '{document_id}' not found",
        )

    application_id = document.application_id
    scheme_id = document.application.scheme_id if document.application else None
    storage_key = document.storage_key
    doc_type = document.doc_type

    # Delete from MinIO
    try:
        storage_service.delete_file(storage_key)
    except Exception as e:
        # Log but don't fail if file already missing
        pass

    # Delete from database
    db.delete(document)

    # Create audit log with cryptographic hash chain
    from app.services.audit_service import create_audit_log
    create_audit_log(
        db=db,
        application_id=application_id,
        scheme_id=scheme_id,
        actor_user_id=current_user.id,
        action="document_deleted",
        details={
            "doc_type": doc_type,
            "storage_key": storage_key,
        },
    )

    db.commit()


@router.post(
    "/documents/{document_id}/reprocess",
    response_model=DocumentRead,
)
def reprocess_document(
    document_id: uuid.UUID,
    current_user: Annotated[User, Depends(require_any_role)],
    db: Session = Depends(get_db),
) -> DocumentRead:
    """
    Re-process a document through OCR and field extraction.

    Useful for re-running extraction after fixing OCR issues or
    when extraction logic has been improved.

    Requires any authenticated role.
    """
    document = db.query(Document).filter(Document.id == document_id).first()
    if not document:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Document with id '{document_id}' not found",
        )

    # Re-run processing
    process_document(db, document_id)
    db.refresh(document)

    # Generate presigned URL for response
    download_url = storage_service.get_presigned_url(document.storage_key)

    return DocumentRead(
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
    )


from pydantic import BaseModel

class DocumentReviewActionRequest(BaseModel):
    remarks: Optional[str] = None
    reason_code: Optional[str] = "OFFICER_REVIEW"


@router.post(
    "/documents/{document_id}/verify",
    response_model=DocumentRead,
)
@router.post(
    "/{application_id}/documents/{document_id}/verify",
    response_model=DocumentRead,
)
def verify_document_by_officer(
    document_id: uuid.UUID,
    application_id: Optional[uuid.UUID] = None,
    action: Optional[DocumentReviewActionRequest] = None,
    current_user: Annotated[Optional[User], Depends(get_optional_current_user)] = None,
    db: Session = Depends(get_db),
) -> DocumentRead:
    """
    Officer manual verification: marks document as VERIFIED, clears automated deficiency flags,
    and logs officer review notes and immutable audit trail.
    """
    from datetime import datetime, timezone
    from app.services.audit_service import create_audit_log

    document = db.query(Document).filter(Document.id == document_id).first()
    if not document:
        raise HTTPException(status_code=404, detail="Document not found")

    document.status = DocumentStatus.VERIFIED
    document.reviewed_at = datetime.now(timezone.utc)
    document.deficiency_reasons = []

    if document.extracted_fields is None:
        document.extracted_fields = {}

    document.extracted_fields["_officer_review"] = {
        "verified_by": current_user.email if current_user else "Scrutiny Officer",
        "role": current_user.role.value if current_user else "SCRUTINY_OFFICER",
        "verified_at": datetime.now(timezone.utc).isoformat(),
        "remarks": action.remarks if action else "Document manually verified by Officer",
    }

    create_audit_log(
        db=db,
        application_id=document.application_id,
        scheme_id=document.application.scheme_id if document.application else None,
        actor_user_id=current_user.id if current_user else None,
        action="document_verified_by_officer",
        details={
            "document_id": str(document.id),
            "doc_type": document.doc_type,
            "remarks": action.remarks if action else "Manually verified",
        },
    )

    db.commit()
    db.refresh(document)
    download_url = storage_service.get_presigned_url(document.storage_key)

    return DocumentRead(
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
    )


@router.post(
    "/documents/{document_id}/flag-deficient",
    response_model=DocumentRead,
)
@router.post(
    "/{application_id}/documents/{document_id}/flag-deficient",
    response_model=DocumentRead,
)
def flag_document_deficient_by_officer(
    document_id: uuid.UUID,
    application_id: Optional[uuid.UUID] = None,
    action: Optional[DocumentReviewActionRequest] = None,
    current_user: Annotated[Optional[User], Depends(get_optional_current_user)] = None,
    db: Session = Depends(get_db),
) -> DocumentRead:
    """
    Officer deficiency flagging: flags document as DEFICIENT, attaches specific deficiency reasons,
    and logs officer review notes.
    """
    from datetime import datetime, timezone
    from app.services.audit_service import create_audit_log

    document = db.query(Document).filter(Document.id == document_id).first()
    if not document:
        raise HTTPException(status_code=404, detail="Document not found")

    message = action.remarks if action and action.remarks else "Document flagged as deficient by Scrutiny Officer"
    code = action.reason_code if action and action.reason_code else "OFFICER_FLAGGED"

    document.status = DocumentStatus.DEFICIENT
    document.reviewed_at = datetime.now(timezone.utc)
    document.deficiency_reasons = [{"code": code, "message": message}]

    if document.extracted_fields is None:
        document.extracted_fields = {}

    document.extracted_fields["_officer_review"] = {
        "flagged_by": current_user.email if current_user else "Scrutiny Officer",
        "role": current_user.role.value if current_user else "SCRUTINY_OFFICER",
        "flagged_at": datetime.now(timezone.utc).isoformat(),
        "remarks": message,
    }

    create_audit_log(
        db=db,
        application_id=document.application_id,
        scheme_id=document.application.scheme_id if document.application else None,
        actor_user_id=current_user.id if current_user else None,
        action="document_flagged_deficient_by_officer",
        details={
            "document_id": str(document.id),
            "doc_type": document.doc_type,
            "remarks": message,
        },
    )

    db.commit()
    db.refresh(document)
    download_url = storage_service.get_presigned_url(document.storage_key)

    return DocumentRead(
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
    )