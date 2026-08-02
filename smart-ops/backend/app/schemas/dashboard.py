import uuid
from datetime import date, datetime
from typing import Any, Dict, List, Optional

from pydantic import BaseModel, ConfigDict


class RecentActivityItem(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    action: str
    entity_type: Optional[str] = None
    entity_id: Optional[str] = None
    description: Optional[str] = None
    created_at: datetime
    project_id: Optional[uuid.UUID] = None
    user_id: Optional[uuid.UUID] = None


class UpcomingDeadlineItem(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    type: str  # "milestone" | "deliverable"
    title: str
    due_date: Optional[date] = None
    project_id: uuid.UUID


class PendingApprovalItem(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    title: str
    project_id: uuid.UUID
    decision_date: Optional[date] = None


class RecentDocumentItem(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    name: str
    folder: Optional[str] = None
    created_at: datetime


class QuickAction(BaseModel):
    label: str
    action: str
    icon: Optional[str] = None


class DashboardSummary(BaseModel):
    project_summary: Dict[str, int]
    project_health: Dict[str, int]
    recent_activity: List[RecentActivityItem]
    upcoming_deadlines: List[UpcomingDeadlineItem]
    pending_approvals: List[PendingApprovalItem]
    open_tasks_count: int
    recent_documents: List[RecentDocumentItem]
    unread_messages_count: int
    milestones: List[UpcomingDeadlineItem]
    quick_actions: List[QuickAction]
