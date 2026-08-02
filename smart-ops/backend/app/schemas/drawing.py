import uuid
from datetime import datetime
from typing import List, Optional

from pydantic import BaseModel, ConfigDict


class DrawingBase(BaseModel):
    title: str
    discipline: Optional[str] = None
    file_url: Optional[str] = None
    status: str = "draft"


class DrawingCreate(DrawingBase):
    project_id: uuid.UUID


class DrawingUpdate(BaseModel):
    title: Optional[str] = None
    discipline: Optional[str] = None
    file_url: Optional[str] = None
    status: Optional[str] = None


class DrawingRead(DrawingBase):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    project_id: uuid.UUID
    version: int
    uploaded_by_user_id: Optional[uuid.UUID] = None
    created_at: datetime


class DrawingCommentBase(BaseModel):
    body: str


class DrawingCommentCreate(DrawingCommentBase):
    pass


class DrawingCommentRead(DrawingCommentBase):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    drawing_id: uuid.UUID
    user_id: uuid.UUID
    created_at: datetime


class DrawingDetailRead(DrawingRead):
    comments: List[DrawingCommentRead] = []
