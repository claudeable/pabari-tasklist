import uuid
from datetime import datetime
from typing import Optional

from pydantic import BaseModel, ConfigDict


class ProjectUpdateAttachmentRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    update_id: uuid.UUID
    filename: str
    file_mime_type: str
    file_size: Optional[int] = None
    created_at: datetime


class ProjectUpdateCommentRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    update_id: uuid.UUID
    user_id: Optional[uuid.UUID] = None
    user_name: Optional[str] = None
    body: str
    created_at: datetime


class ProjectUpdateCommentCreate(BaseModel):
    body: str


class ProjectUpdateEdit(BaseModel):
    body: Optional[str] = None
    posted_at: Optional[datetime] = None
    email_from: Optional[str] = None
    email_subject: Optional[str] = None
    status: Optional[str] = None
    current_capacity: Optional[str] = None
    project_requirement: Optional[str] = None
    internal_notes: Optional[str] = None
    action_items: Optional[str] = None


class ProjectUpdateCreate(BaseModel):
    body: str
    source: str = "internal"
    email_from: Optional[str] = None
    email_subject: Optional[str] = None
    posted_at: Optional[datetime] = None
    parent_update_id: Optional[uuid.UUID] = None
    current_capacity: Optional[str] = None
    project_requirement: Optional[str] = None
    internal_notes: Optional[str] = None
    action_items: Optional[str] = None


class ProjectUpdateRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    project_id: uuid.UUID
    user_id: Optional[uuid.UUID] = None
    user_name: Optional[str] = None
    body: str
    source: str
    status: str = "open"
    email_from: Optional[str] = None
    email_subject: Optional[str] = None
    current_capacity: Optional[str] = None
    project_requirement: Optional[str] = None
    internal_notes: Optional[str] = None
    action_items: Optional[str] = None
    posted_at: datetime
    created_at: datetime
    parent_update_id: Optional[uuid.UUID] = None
    parent_body_snippet: Optional[str] = None
    attachments: list[ProjectUpdateAttachmentRead] = []
    comments: list[ProjectUpdateCommentRead] = []
