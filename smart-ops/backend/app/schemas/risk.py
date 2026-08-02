import uuid
from datetime import datetime
from typing import Optional

from pydantic import BaseModel, ConfigDict

from app.models.risk import RiskLikelihood, RiskSeverity, RiskStatus


class RiskBase(BaseModel):
    title: str
    description: Optional[str] = None
    severity: RiskSeverity = RiskSeverity.medium
    likelihood: RiskLikelihood = RiskLikelihood.medium
    status: RiskStatus = RiskStatus.open


class RiskCreate(RiskBase):
    project_id: uuid.UUID
    owner_user_id: Optional[uuid.UUID] = None


class RiskUpdate(BaseModel):
    title: Optional[str] = None
    description: Optional[str] = None
    severity: Optional[RiskSeverity] = None
    likelihood: Optional[RiskLikelihood] = None
    status: Optional[RiskStatus] = None
    owner_user_id: Optional[uuid.UUID] = None


class RiskRead(RiskBase):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    project_id: uuid.UUID
    owner_user_id: Optional[uuid.UUID] = None
    created_at: datetime
