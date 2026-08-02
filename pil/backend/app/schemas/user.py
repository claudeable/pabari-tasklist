from __future__ import annotations

import uuid
from datetime import datetime

from pydantic import BaseModel, ConfigDict


class DeviceResponse(BaseModel):
    model_config = ConfigDict(extra="forbid", from_attributes=True)

    # See OrganizationResponse.id comment: model_validate(device) needs a UUID
    # field, not str, to accept the ORM's native uuid.UUID id column.
    id: uuid.UUID
    device_name: str | None
    trusted: bool
    first_seen_at: datetime
    last_seen_at: datetime
    revoked_at: datetime | None


class SessionResponse(BaseModel):
    model_config = ConfigDict(extra="forbid", from_attributes=True)

    id: str
    device_id: str
    ip_address: str
    issued_at: datetime
    expires_at: datetime


class MeResponse(BaseModel):
    model_config = ConfigDict(extra="forbid", from_attributes=True)

    id: str
    alias: str
    system_role: str
    mfa_enabled: bool
