import uuid
from datetime import datetime
from typing import Optional

from pydantic import BaseModel, ConfigDict


class DocumentBase(BaseModel):
    folder: Optional[str] = None
    name: str
    file_url: Optional[str] = None
    status: str = "draft"


class DocumentCreate(DocumentBase):
    project_id: Optional[uuid.UUID] = None
    organization_id: Optional[uuid.UUID] = None


class DocumentUpdate(BaseModel):
    folder: Optional[str] = None
    name: Optional[str] = None
    file_url: Optional[str] = None
    status: Optional[str] = None


class DocumentRead(DocumentBase):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    project_id: Optional[uuid.UUID] = None
    organization_id: Optional[uuid.UUID] = None
    version: int
    uploaded_by_user_id: Optional[uuid.UUID] = None
    created_at: datetime
