from __future__ import annotations

import uuid
from datetime import datetime

from pydantic import BaseModel, ConfigDict, Field


class ChannelCreateRequest(BaseModel):
    model_config = ConfigDict(extra="forbid")

    name: str = Field(min_length=1, max_length=100)
    is_private: bool = False
    member_ids: list[str] = Field(default_factory=list)


class ChannelResponse(BaseModel):
    model_config = ConfigDict(extra="forbid", from_attributes=True)

    # See OrganizationResponse.id comment: model_validate(channel) needs a UUID
    # field, not str, to accept the ORM's native uuid.UUID id column.
    id: uuid.UUID
    project_id: uuid.UUID
    name: str
    is_private: bool
    created_at: datetime


class DmCreateRequest(BaseModel):
    model_config = ConfigDict(extra="forbid")

    other_user_id: str


class MessageCreateRequest(BaseModel):
    model_config = ConfigDict(extra="forbid")

    body: str = Field(min_length=1, max_length=8000)
    parent_message_id: str | None = None


class MessageUpdateRequest(BaseModel):
    model_config = ConfigDict(extra="forbid")

    body: str = Field(min_length=1, max_length=8000)


class MessageAttachmentResponse(BaseModel):
    model_config = ConfigDict(extra="forbid")

    id: str
    filename: str
    mime_type: str
    size_bytes: int


class MessageResponse(BaseModel):
    model_config = ConfigDict(extra="forbid")

    id: str
    channel_id: str
    author_id: str
    parent_message_id: str | None
    body: str
    mentions: list[str]
    edited_at: datetime | None
    created_at: datetime
    attachment: MessageAttachmentResponse | None = None


class AttachmentViewUrlResponse(BaseModel):
    model_config = ConfigDict(extra="forbid")

    token: str
    expires_in: int


class MessageSearchResponse(BaseModel):
    model_config = ConfigDict(extra="forbid")

    message_ids: list[str]
