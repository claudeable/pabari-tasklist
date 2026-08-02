import uuid
from datetime import date, datetime
from typing import List, Optional

from pydantic import BaseModel, ConfigDict

from app.models.project import ProjectHealth, ProjectStatus
from app.schemas.decision import DecisionRead
from app.schemas.deliverable import DeliverableRead
from app.schemas.milestone import MilestoneRead
from app.schemas.risk import RiskRead


class ProjectBase(BaseModel):
    name: str
    code: Optional[str] = None
    description: Optional[str] = None
    status: ProjectStatus = ProjectStatus.planning
    health: ProjectHealth = ProjectHealth.on_track
    start_date: Optional[date] = None
    end_date: Optional[date] = None
    budget_amount: Optional[float] = None
    budget_currency: Optional[str] = "USD"


class ProjectCreate(ProjectBase):
    pass


class ProjectUpdate(BaseModel):
    name: Optional[str] = None
    code: Optional[str] = None
    description: Optional[str] = None
    status: Optional[ProjectStatus] = None
    health: Optional[ProjectHealth] = None
    start_date: Optional[date] = None
    end_date: Optional[date] = None
    budget_amount: Optional[float] = None
    budget_currency: Optional[str] = None


class ProjectRead(ProjectBase):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    created_at: datetime


class ProjectParticipantRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    project_id: uuid.UUID
    organization_id: uuid.UUID
    user_id: Optional[uuid.UUID] = None
    role_on_project: Optional[str] = None


class ActivityLogRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    action: str
    entity_type: Optional[str] = None
    entity_id: Optional[str] = None
    description: Optional[str] = None
    created_at: datetime


class ProjectDetailRead(ProjectRead):
    milestones: List[MilestoneRead] = []
    deliverables: List[DeliverableRead] = []
    risks: List[RiskRead] = []
    decisions: List[DecisionRead] = []
    participants: List[ProjectParticipantRead] = []
    activity: List[ActivityLogRead] = []
