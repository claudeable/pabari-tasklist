from datetime import date, timedelta

from fastapi import APIRouter, Depends
from sqlalchemy import func
from sqlalchemy.orm import Session

from app.core.deps import get_current_user, get_db
from app.models.activity_log import ActivityLog
from app.models.decision import Decision, DecisionStatus
from app.models.deliverable import Deliverable
from app.models.document import Document
from app.models.milestone import Milestone, MilestoneStatus
from app.models.notification import Notification
from app.models.project import Project
from app.models.task import Task
from app.models.user import User
from app.schemas.dashboard import (
    DashboardSummary,
    PendingApprovalItem,
    QuickAction,
    RecentActivityItem,
    RecentDocumentItem,
    UpcomingDeadlineItem,
)

router = APIRouter()


@router.get("/summary", response_model=DashboardSummary)
def get_dashboard_summary(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> DashboardSummary:
    status_counts = dict(
        db.query(Project.status, func.count(Project.id)).group_by(Project.status).all()
    )
    project_summary = {
        (k.value if hasattr(k, "value") else k): v for k, v in status_counts.items()
    }

    health_counts = dict(
        db.query(Project.health, func.count(Project.id)).group_by(Project.health).all()
    )
    project_health = {
        (k.value if hasattr(k, "value") else k): v for k, v in health_counts.items()
    }

    recent_activity = (
        db.query(ActivityLog).order_by(ActivityLog.created_at.desc()).limit(10).all()
    )

    soon = date.today() + timedelta(days=30)

    upcoming_milestones = (
        db.query(Milestone)
        .filter(Milestone.due_date.isnot(None), Milestone.due_date <= soon)
        .filter(Milestone.status != MilestoneStatus.completed)
        .order_by(Milestone.due_date.asc())
        .limit(10)
        .all()
    )
    upcoming_deliverables = (
        db.query(Deliverable)
        .filter(Deliverable.due_date.isnot(None), Deliverable.due_date <= soon)
        .order_by(Deliverable.due_date.asc())
        .limit(10)
        .all()
    )

    upcoming_deadlines = [
        UpcomingDeadlineItem(
            id=m.id, type="milestone", title=m.title, due_date=m.due_date, project_id=m.project_id
        )
        for m in upcoming_milestones
    ] + [
        UpcomingDeadlineItem(
            id=d.id, type="deliverable", title=d.title, due_date=d.due_date, project_id=d.project_id
        )
        for d in upcoming_deliverables
    ]

    pending_approvals_raw = (
        db.query(Decision)
        .filter(Decision.status == DecisionStatus.proposed)
        .order_by(Decision.decision_date.asc().nullslast())
        .limit(20)
        .all()
    )
    pending_approvals = [
        PendingApprovalItem(
            id=d.id, title=d.title, project_id=d.project_id, decision_date=d.decision_date
        )
        for d in pending_approvals_raw
    ]

    open_tasks_count = (
        db.query(func.count(Task.id)).filter(Task.status != "done").scalar() or 0
    )

    recent_documents = (
        db.query(Document).order_by(Document.created_at.desc()).limit(5).all()
    )

    unread_messages_count = (
        db.query(func.count(Notification.id))
        .filter(Notification.user_id == current_user.id, Notification.is_read.is_(False))
        .scalar()
        or 0
    )

    quick_actions = [
        QuickAction(label="New Project", action="create_project", icon="plus-circle"),
        QuickAction(label="Upload Document", action="upload_document", icon="upload"),
        QuickAction(label="Schedule Meeting", action="schedule_meeting", icon="calendar"),
        QuickAction(label="Create Task", action="create_task", icon="check-square"),
        QuickAction(label="Log Decision", action="log_decision", icon="gavel"),
    ]

    return DashboardSummary(
        project_summary=project_summary,
        project_health=project_health,
        recent_activity=recent_activity,
        upcoming_deadlines=upcoming_deadlines,
        pending_approvals=pending_approvals,
        open_tasks_count=open_tasks_count,
        recent_documents=recent_documents,
        unread_messages_count=unread_messages_count,
        milestones=[
            UpcomingDeadlineItem(
                id=m.id, type="milestone", title=m.title, due_date=m.due_date, project_id=m.project_id
            )
            for m in upcoming_milestones
        ],
        quick_actions=quick_actions,
    )
