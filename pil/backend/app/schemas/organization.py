from __future__ import annotations

import uuid
from datetime import datetime

from pydantic import BaseModel, ConfigDict, Field


class OrganizationCreateRequest(BaseModel):
    model_config = ConfigDict(extra="forbid")

    name: str = Field(min_length=2, max_length=120)
    initial_admin_user_id: str


class OrganizationResponse(BaseModel):
    model_config = ConfigDict(extra="forbid", from_attributes=True)

    # ORM returns a uuid.UUID (native Postgres UUID column); pydantic v2 does not
    # coerce UUID -> str for a plain `str` field under from_attributes, so this
    # crashed model_validate(org) with a 500 for every real request. UUID here
    # still serializes to a plain string in the JSON response, so the wire
    # contract with the frontend doesn't change.
    id: uuid.UUID
    name: str
    slug: str
    status: str
    created_at: datetime


class OrganizationMemberInviteRequest(BaseModel):
    model_config = ConfigDict(extra="forbid")

    user_id: str
    role: str = Field(pattern=r"^(org_admin|member)$")


class OrganizationMemberResponse(BaseModel):
    model_config = ConfigDict(extra="forbid", from_attributes=True)

    user_id: uuid.UUID
    role: str
    joined_at: datetime
