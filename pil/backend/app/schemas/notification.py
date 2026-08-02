from __future__ import annotations

import uuid
from datetime import datetime

from pydantic import BaseModel, ConfigDict


class NotificationResponse(BaseModel):
    model_config = ConfigDict(extra="forbid", from_attributes=True)

    # See OrganizationResponse.id comment: model_validate(notification) needs a
    # UUID field, not str, to accept the ORM's native uuid.UUID id column.
    id: uuid.UUID
    type: str
    payload: dict
    read_at: datetime | None
    created_at: datetime
