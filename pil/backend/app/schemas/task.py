from __future__ import annotations

import uuid
from datetime import date, datetime

from pydantic import BaseModel, ConfigDict, Field

_STATUS_PATTERN = r"^(todo|in_progress|review|done)$"
_PRIORITY_PATTERN = r"^(low|medium|high|critical)$"
_CATEGORY_PATTERN = r"^(legal|finance|projects|other)$"


class TaskCreateRequest(BaseModel):
    model_config = ConfigDict(extra="forbid")

    title: str = Field(min_length=1, max_length=255)
    description: str | None = Field(default=None, max_length=10000)
    priority: str = Field(default="medium", pattern=_PRIORITY_PATTERN)
    category: str | None = Field(default=None, pattern=_CATEGORY_PATTERN)
    assignee_id: str | None = None
    due_date: date | None = None
    milestone_id: str | None = None


class TaskUpdateRequest(BaseModel):
    model_config = ConfigDict(extra="forbid")

    title: str | None = Field(default=None, min_length=1, max_length=255)
    description: str | None = Field(default=None, max_length=10000)
    priority: str | None = Field(default=None, pattern=_PRIORITY_PATTERN)
    status: str | None = Field(default=None, pattern=_STATUS_PATTERN)
    category: str | None = None
    clear_category: bool = False
    # Explicit has_* flags let the API layer distinguish "omitted" from "set to null"
    # for nullable fields, without relying on fragile Pydantic model_fields_set
    # plumbing leaking into the service layer (task_service.NOT_PROVIDED sentinel).
    assignee_id: str | None = None
    clear_assignee: bool = False
    milestone_id: str | None = None
    clear_milestone: bool = False
    due_date: date | None = None
    clear_due_date: bool = False


class TaskResponse(BaseModel):
    model_config = ConfigDict(extra="forbid", from_attributes=True)

    id: str
    project_id: str
    title: str
    description: str | None
    status: str
    priority: str
    category: str | None
    # Most recent progress note, distinct from `description` (a static field set
    # once at creation). None if no update has ever been posted for this task.
    latest_update: str | None = None
    latest_update_at: datetime | None = None
    # Harshil's dedicated comment field — distinct from the task_comments progress
    # log, and gated to settings.task_approver_alias at the API layer (see tasks.py).
    hk_comment: str | None = None
    hk_comment_at: datetime | None = None
    assignee_id: str | None
    due_date: date | None
    milestone_id: str | None
    created_by: str
    created_at: datetime


class TaskCommentCreateRequest(BaseModel):
    model_config = ConfigDict(extra="forbid")

    body: str = Field(min_length=1, max_length=5000)


class TaskCommentAttachmentResponse(BaseModel):
    model_config = ConfigDict(extra="forbid")

    document_id: str
    filename: str
    mime_type: str
    size_bytes: int


class TaskCommentResponse(BaseModel):
    model_config = ConfigDict(extra="forbid", from_attributes=True)

    id: str
    task_id: str
    author_id: str
    body: str
    created_at: datetime
    attachment: TaskCommentAttachmentResponse | None = None


class TaskHkCommentRequest(BaseModel):
    model_config = ConfigDict(extra="forbid")

    body: str = Field(min_length=1, max_length=5000)


class TaskAttachmentRequest(BaseModel):
    model_config = ConfigDict(extra="forbid")

    document_id: str


class MilestoneCreateRequest(BaseModel):
    model_config = ConfigDict(extra="forbid")

    name: str = Field(min_length=1, max_length=150)
    due_date: date | None = None


class MilestoneResponse(BaseModel):
    model_config = ConfigDict(extra="forbid", from_attributes=True)

    # See OrganizationResponse.id comment: model_validate(milestone) needs a
    # UUID field, not str, to accept the ORM's native uuid.UUID id column.
    id: uuid.UUID
    project_id: uuid.UUID
    name: str
    due_date: date | None
    created_at: datetime


class AnnouncementCreateRequest(BaseModel):
    model_config = ConfigDict(extra="forbid")

    title: str = Field(min_length=1, max_length=255)
    body: str = Field(min_length=1, max_length=10000)


class AnnouncementResponse(BaseModel):
    model_config = ConfigDict(extra="forbid", from_attributes=True)

    # See OrganizationResponse.id comment: model_validate(announcement) needs a
    # UUID field, not str, to accept the ORM's native uuid.UUID id column.
    id: uuid.UUID
    project_id: uuid.UUID
    author_id: uuid.UUID
    title: str
    body: str
    created_at: datetime
