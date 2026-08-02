from __future__ import annotations

import uuid
from datetime import datetime

from pydantic import BaseModel, ConfigDict, Field


class ProjectCreateRequest(BaseModel):
    model_config = ConfigDict(extra="forbid")

    name: str = Field(min_length=2, max_length=150)
    description: str | None = Field(default=None, max_length=2000)


class ProjectUpdateRequest(BaseModel):
    model_config = ConfigDict(extra="forbid")

    name: str | None = Field(default=None, min_length=2, max_length=150)
    description: str | None = Field(default=None, max_length=2000)


class ProjectResponse(BaseModel):
    model_config = ConfigDict(extra="forbid", from_attributes=True)

    # See OrganizationResponse.id comment: model_validate(project) needs a UUID
    # field, not str, to accept the ORM's native uuid.UUID id column.
    id: uuid.UUID
    organization_id: uuid.UUID
    name: str
    description: str | None
    created_at: datetime


class ProjectMemberAddRequest(BaseModel):
    model_config = ConfigDict(extra="forbid")

    user_id: str
    role: str = Field(pattern=r"^(project_admin|member|read_only|guest)$")


class ProjectMemberRoleUpdateRequest(BaseModel):
    model_config = ConfigDict(extra="forbid")

    role: str = Field(pattern=r"^(project_admin|member|read_only|guest)$")


class ProjectMemberResponse(BaseModel):
    model_config = ConfigDict(extra="forbid", from_attributes=True)

    user_id: uuid.UUID
    alias: str
    role: str
    added_at: datetime
