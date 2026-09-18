"""
Pydantic schemas for Document entity.
"""

import uuid
from datetime import datetime
from typing import Any, Optional
from pydantic import BaseModel, ConfigDict

from app.models.document import DocumentStatus


class DocumentBase(BaseModel):
    """Shared document properties."""
    application_id: uuid.UUID
    doc_type: str
    storage_key: str
    status: DocumentStatus = DocumentStatus.PENDING
    extracted_fields: Optional[Any] = None
    deficiency_reasons: Optional[Any] = None


class DocumentCreate(DocumentBase):
    """Properties required on document creation."""
    pass


class DocumentRead(DocumentBase):
    """Properties returned on document read."""
    id: uuid.UUID
    uploaded_at: datetime
    reviewed_at: Optional[datetime] = None
    # Presigned download URL - computed at response time, not stored
    download_url: Optional[str] = None

    model_config = ConfigDict(from_attributes=True)
