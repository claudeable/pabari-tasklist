import uuid
from datetime import datetime
from typing import Optional

from pydantic import BaseModel, ConfigDict


class MeetingBase(BaseModel):
    title: str
    scheduled_at: Optional[datetime] = None
    status: str = "scheduled"


class MeetingCreate(MeetingBase):
    project_id: uuid.UUID


class MeetingUpdate(BaseModel):
    title: Optional[str] = None
    scheduled_at: Optional[datetime] = None
    status: Optional[str] = None


class MeetingRead(MeetingBase):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    project_id: uuid.UUID
    created_at: datetime
