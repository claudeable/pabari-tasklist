import uuid
from typing import Optional

from pydantic import AliasPath, BaseModel, ConfigDict, Field


class ProjectParticipantBase(BaseModel):
    role_on_project: Optional[str] = None


class ProjectParticipantCreate(ProjectParticipantBase):
    project_id: uuid.UUID
    organization_id: Optional[uuid.UUID] = None
    user_id: Optional[uuid.UUID] = None


class ProjectParticipantUpdate(BaseModel):
    organization_id: Optional[uuid.UUID] = None
    user_id: Optional[uuid.UUID] = None
    role_on_project: Optional[str] = None


class ProjectParticipantRead(ProjectParticipantBase):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    project_id: uuid.UUID
    organization_id: uuid.UUID
    user_id: Optional[uuid.UUID] = None
    user_name: Optional[str] = Field(default=None, validation_alias=AliasPath("user", "full_name"))
    avatar_url: Optional[str] = Field(default=None, validation_alias=AliasPath("user", "avatar_url"))
    organization_name: Optional[str] = Field(default=None, validation_alias=AliasPath("organization", "name"))
