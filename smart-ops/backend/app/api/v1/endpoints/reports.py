import uuid
from datetime import date, datetime, timezone
from zoneinfo import ZoneInfo

from fastapi import APIRouter, Depends, HTTPException
from fastapi.responses import Response
from sqlalchemy import func
from sqlalchemy.orm import Session, joinedload, selectinload

from app.core.deps import get_db, require_permission
from app.models.activity_log import ActivityLog
from app.models.milestone import Milestone, MilestoneStatus
from app.models.project import Project
from app.models.project_update import ProjectUpdate, ProjectUpdateComment
from app.core.report_export import build_xlsx
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


@router.get("/project-updates")
def project_updates_report(
    project_id: uuid.UUID | None = None,
    start_date: date | None = None,
    end_date: date | None = None,
    status: str | None = None,
    export: str | None = None,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_permission("reports.view")),
):
    if start_date and end_date and start_date > end_date:
        raise HTTPException(status_code=400, detail="Start date must be on or before end date")
    if status not in (None, "open", "in_progress", "done"):
        raise HTTPException(status_code=400, detail="Invalid update status")
    if export not in (None, "xlsx"):
        raise HTTPException(status_code=400, detail="Unsupported export format")
    projects_query = db.query(Project)
    if project_id:
        projects_query = projects_query.filter(Project.id == project_id)
    projects = projects_query.order_by(Project.name).all()
    if project_id and not projects:
        raise HTTPException(status_code=404, detail="Project not found")
    updates_query = db.query(ProjectUpdate).options(
        joinedload(ProjectUpdate.user),
        selectinload(ProjectUpdate.comments).joinedload(ProjectUpdateComment.user),
    )
    if project_id:
        updates_query = updates_query.filter(ProjectUpdate.project_id == project_id)
    local_day = func.date(func.timezone("Africa/Nairobi", ProjectUpdate.posted_at))
    if start_date:
        updates_query = updates_query.filter(local_day >= start_date)
    if end_date:
        updates_query = updates_query.filter(local_day <= end_date)
    if status:
        updates_query = updates_query.filter(ProjectUpdate.status == status)
    updates = updates_query.order_by(ProjectUpdate.posted_at.desc(), ProjectUpdate.id).all()
    grouped = {p.id: {"id": str(p.id), "name": p.name, "status": p.status.value, "updates": []} for p in projects}
    for update in updates:
        if update.project_id not in grouped:
            continue
        item = {field: getattr(update, field) for field in (
            "body", "status", "current_capacity", "project_requirement", "internal_notes", "action_items"
        )}
        item.update(id=str(update.id), posted_at=update.posted_at.isoformat(),
                    author=update.user.full_name if update.user else "Unknown user",
                    comments=[{"author": c.user.full_name if c.user else "Unknown user",
                               "body": c.body, "created_at": c.created_at.isoformat()}
                              for c in update.comments])
        grouped[update.project_id]["updates"].append(item)
    report = {"generated_at": datetime.now(timezone.utc).isoformat(), "timezone": "Africa/Nairobi",
              "start_date": start_date, "end_date": end_date, "status": status,
              "projects": list(grouped.values()), "update_count": len(updates)}
    if export == "xlsx":
        rows = [["Project", "Update date (Nairobi)", "Status", "Author", "Current capacities", "Project requirement", "Update", "Comments / notes", "Remarks", "Discussion comments"]]
        for project in report["projects"]:
            for item in project["updates"]:
                local_date = datetime.fromisoformat(item["posted_at"]).astimezone(ZoneInfo("Africa/Nairobi")).strftime("%Y-%m-%d %H:%M")
                comments = "\n\n".join(c["author"] + ": " + c["body"] for c in item["comments"])
                rows.append([project["name"], local_date, item["status"].replace("_", " "), item["author"],
                             item["current_capacity"], item["project_requirement"], item["body"],
                             item["internal_notes"], item["action_items"], comments])
            if not project["updates"]:
                rows.append([project["name"], "", "", "", "", "", "No updates match these filters", "", "", ""])
        return Response(build_xlsx(rows), media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
                        headers={"Content-Disposition": 'attachment; filename="smart-ops-project-updates.xlsx"', "Cache-Control": "no-store"})
    return report
