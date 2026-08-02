import uuid
from typing import Dict, List, Optional

from pydantic import BaseModel


class ProjectProgressItem(BaseModel):
    project_id: uuid.UUID
    name: str
    status: str
    health: str
    milestone_total: int
    milestone_completed: int
    milestone_completion_percent: float


class TasksSummary(BaseModel):
    by_status: Dict[str, int]
    by_priority: Dict[str, int]
    total: int


class RisksSummary(BaseModel):
    by_severity: Dict[str, int]
    by_status: Dict[str, int]
    total: int
