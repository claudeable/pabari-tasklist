from fastapi import APIRouter, Depends
from sqlalchemy import func
from sqlalchemy.orm import Session

from app.core.deps import get_db, require_permission
from app.models.activity_log import ActivityLog
from app.models.milestone import Milestone, MilestoneStatus
from app.models.project import Project
from app.models.risk import Risk
from app.models.task import Task
from app.models.user import User
from app.schemas.project import ActivityLogRead
from app.schemas.report import ProjectProgressItem, RisksSummary, TasksSummary

router = APIRouter()


@router.get("/project-progress", response_model=list[ProjectProgressItem])
def project_progress(
    db: Session = Depends(get_db),
    current_user: User = Depends(require_permission("reports.view")),
) -> list[ProjectProgressItem]:
    projects = db.query(Project).order_by(Project.name).all()

    milestone_counts = dict(
        db.query(Milestone.project_id, func.count(Milestone.id))
        .group_by(Milestone.project_id)
        .all()
    )
    completed_counts = dict(
        db.query(Milestone.project_id, func.count(Milestone.id))
        .filter(Milestone.status == MilestoneStatus.completed)
        .group_by(Milestone.project_id)
        .all()
    )

    results = []
    for p in projects:
        total = milestone_counts.get(p.id, 0)
        completed = completed_counts.get(p.id, 0)
        pct = (completed / total * 100) if total else 0.0
        results.append(
            ProjectProgressItem(
                project_id=p.id,
                name=p.name,
                status=p.status.value if hasattr(p.status, "value") else p.status,
                health=p.health.value if hasattr(p.health, "value") else p.health,
                milestone_total=total,
                milestone_completed=completed,
                milestone_completion_percent=round(pct, 1),
            )
        )
    return results


@router.get("/tasks-summary", response_model=TasksSummary)
def tasks_summary(
    db: Session = Depends(get_db),
    current_user: User = Depends(require_permission("reports.view")),
) -> TasksSummary:
    by_status = dict(db.query(Task.status, func.count(Task.id)).group_by(Task.status).all())
    by_priority = dict(
        db.query(Task.priority, func.count(Task.id)).group_by(Task.priority).all()
    )
    total = db.query(func.count(Task.id)).scalar() or 0
    return TasksSummary(by_status=by_status, by_priority=by_priority, total=total)


@router.get("/risks-summary", response_model=RisksSummary)
def risks_summary(
    db: Session = Depends(get_db),
    current_user: User = Depends(require_permission("reports.view")),
) -> RisksSummary:
    by_severity_raw = db.query(Risk.severity, func.count(Risk.id)).group_by(Risk.severity).all()
    by_status_raw = db.query(Risk.status, func.count(Risk.id)).group_by(Risk.status).all()
    by_severity = {(k.value if hasattr(k, "value") else k): v for k, v in by_severity_raw}
    by_status = {(k.value if hasattr(k, "value") else k): v for k, v in by_status_raw}
    total = db.query(func.count(Risk.id)).scalar() or 0
    return RisksSummary(by_severity=by_severity, by_status=by_status, total=total)


@router.get("/activity", response_model=list[ActivityLogRead])
def activity(
    page: int = 1,
    page_size: int = 25,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_permission("reports.view")),
) -> list[ActivityLog]:
    page = max(page, 1)
    page_size = max(min(page_size, 100), 1)
    offset = (page - 1) * page_size
    return (
        db.query(ActivityLog)
        .order_by(ActivityLog.created_at.desc())
        .offset(offset)
        .limit(page_size)
        .all()
    )
