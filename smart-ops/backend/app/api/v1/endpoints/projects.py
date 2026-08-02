import uuid

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.core.audit import log_activity
from app.core.deps import get_current_user, get_db, require_permission
from app.models.activity_log import ActivityLog
from app.models.project import Project
from app.models.user import User
from app.schemas.project import ProjectCreate, ProjectDetailRead, ProjectRead, ProjectUpdate

router = APIRouter()


@router.get("", response_model=list[ProjectRead])
def list_projects(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> list[Project]:
    return db.query(Project).order_by(Project.created_at.desc()).all()


@router.get("/{project_id}", response_model=ProjectDetailRead)
def get_project(
    project_id: uuid.UUID,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> ProjectDetailRead:
    project = db.get(Project, project_id)
    if not project:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Project not found")

    activity = (
        db.query(ActivityLog)
        .filter(ActivityLog.project_id == project_id)
        .order_by(ActivityLog.created_at.desc())
        .limit(50)
        .all()
    )

    detail = ProjectDetailRead.model_validate(project)
    detail.activity = activity
    return detail


@router.post("", response_model=ProjectRead, status_code=status.HTTP_201_CREATED)
def create_project(
    payload: ProjectCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_permission("projects.edit")),
) -> Project:
    project = Project(**payload.model_dump())
    db.add(project)
    db.flush()
    log_activity(
        db,
        user_id=current_user.id,
        action="create",
        entity_type="project",
        entity_id=str(project.id),
        project_id=project.id,
        description=f"Created project '{project.name}'",
    )
    db.commit()
    db.refresh(project)
    return project


@router.put("/{project_id}", response_model=ProjectRead)
def update_project(
    project_id: uuid.UUID,
    payload: ProjectUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_permission("projects.edit")),
) -> Project:
    project = db.get(Project, project_id)
    if not project:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Project not found")

    for field, value in payload.model_dump(exclude_unset=True).items():
        setattr(project, field, value)

    log_activity(
        db,
        user_id=current_user.id,
        action="update",
        entity_type="project",
        entity_id=str(project.id),
        project_id=project.id,
        description=f"Updated project '{project.name}'",
    )

    db.commit()
    db.refresh(project)
    return project


@router.delete("/{project_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_project(
    project_id: uuid.UUID,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_permission("projects.delete")),
) -> None:
    project = db.get(Project, project_id)
    if not project:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Project not found")

    # Note: project_id is intentionally omitted (not set to project.id) —
    # activity_logs.project_id has ON DELETE CASCADE, so a log entry tied to
    # this project would be wiped out by the same delete it's recording.
    log_activity(
        db,
        user_id=current_user.id,
        action="delete",
        entity_type="project",
        entity_id=str(project.id),
        description=f"Deleted project '{project.name}'",
    )

    # All child tables (milestones, deliverables, risks, decisions,
    # participants, tasks, documents, meetings, channels, drawings, site
    # reports, activity logs) declare ForeignKey(..., ondelete="CASCADE") on
    # project_id, so deleting the project row cascades their cleanup at the
    # database level.
    db.delete(project)
    db.commit()
