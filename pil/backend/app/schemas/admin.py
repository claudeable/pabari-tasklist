from __future__ import annotations

from datetime import datetime

from pydantic import BaseModel, ConfigDict, Field

_ALIAS_PATTERN = r"^[A-Za-z][A-Za-z0-9-]{1,30}[A-Za-z0-9]$"


class AdminCreateUserRequest(BaseModel):
    model_config = ConfigDict(extra="forbid")

    alias: str = Field(min_length=3, max_length=32, pattern=_ALIAS_PATTERN)
    system_role: str = Field(default="member", pattern=r"^(member|system_admin)$")


class AdminCreateUserResponse(BaseModel):
    model_config = ConfigDict(extra="forbid")

    id: str
    alias: str
    one_time_password: str


class AdminUserStatusRequest(BaseModel):
    model_config = ConfigDict(extra="forbid")

    status: str = Field(pattern=r"^(active|locked|disabled)$")


class AdminResetPasswordResponse(BaseModel):
    model_config = ConfigDict(extra="forbid")

    one_time_password: str


class AdminSessionResponse(BaseModel):
    model_config = ConfigDict(extra="forbid")

    id: str
    user_id: str
    device_id: str
    ip_address: str
    issued_at: datetime
    expires_at: datetime


class SecurityEventResponse(BaseModel):
    model_config = ConfigDict(extra="forbid")

    id: str
    seq: int
    event_type: str
    severity: str
    user_id: str | None
    organization_id: str | None
    ip_address: str | None
    metadata: dict | None
    created_at: datetime


class StorageUsageResponse(BaseModel):
    model_config = ConfigDict(extra="forbid")

    total_bytes: int
    by_organization: dict[str, int]
