import uuid
from datetime import date
from typing import Optional

from pydantic import BaseModel, ConfigDict


class DeliverableBase(BaseModel):
    title: str
    description: Optional[str] = None
    status: str = "pending"
    due_date: Optional[date] = None


class DeliverableCreate(DeliverableBase):
    project_id: uuid.UUID
    milestone_id: Optional[uuid.UUID] = None
    owner_user_id: Optional[uuid.UUID] = None


class DeliverableUpdate(BaseModel):
    title: Optional[str] = None
    description: Optional[str] = None
    status: Optional[str] = None
    due_date: Optional[date] = None
    milestone_id: Optional[uuid.UUID] = None
    owner_user_id: Optional[uuid.UUID] = None


class DeliverableRead(DeliverableBase):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    project_id: uuid.UUID
    milestone_id: Optional[uuid.UUID] = None
    owner_user_id: Optional[uuid.UUID] = None
