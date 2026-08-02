import uuid
from datetime import date, datetime
from typing import Optional

from pydantic import BaseModel, ConfigDict


class TaskBase(BaseModel):
    title: str
    description: Optional[str] = None
    priority: str = "medium"
    status: str = "open"
    due_date: Optional[date] = None
    progress_percent: int = 0


class TaskCreate(TaskBase):
    project_id: uuid.UUID
    owner_user_id: Optional[uuid.UUID] = None
    assigned_organization_id: Optional[uuid.UUID] = None


class TaskUpdate(BaseModel):
    title: Optional[str] = None
    description: Optional[str] = None
    priority: Optional[str] = None
    status: Optional[str] = None
    due_date: Optional[date] = None
    progress_percent: Optional[int] = None
    owner_user_id: Optional[uuid.UUID] = None
    assigned_organization_id: Optional[uuid.UUID] = None


class TaskRead(TaskBase):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    project_id: uuid.UUID
    owner_user_id: Optional[uuid.UUID] = None
    owner_name: Optional[str] = None
    assigned_organization_id: Optional[uuid.UUID] = None
    created_at: datetime


class TaskUpdatePost(BaseModel):
    description: str


class TaskUpdateEntry(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    description: Optional[str] = None
    user_id: Optional[uuid.UUID] = None
    user_name: Optional[str] = None
    created_at: datetime
