import uuid
from datetime import date
from typing import Optional

from pydantic import BaseModel, ConfigDict

from app.models.decision import DecisionStatus


class DecisionBase(BaseModel):
    title: str
    description: Optional[str] = None
    decision_date: Optional[date] = None
    status: DecisionStatus = DecisionStatus.proposed


class DecisionCreate(DecisionBase):
    project_id: uuid.UUID
    decided_by_user_id: Optional[uuid.UUID] = None


class DecisionUpdate(BaseModel):
    title: Optional[str] = None
    description: Optional[str] = None
    decision_date: Optional[date] = None
    status: Optional[DecisionStatus] = None
    decided_by_user_id: Optional[uuid.UUID] = None


class DecisionRead(DecisionBase):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    project_id: uuid.UUID
    decided_by_user_id: Optional[uuid.UUID] = None
