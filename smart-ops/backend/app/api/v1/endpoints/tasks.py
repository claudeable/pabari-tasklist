import uuid
from typing import Optional

from fastapi import APIRouter, BackgroundTasks, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.core.audit import log_activity, notify_user
from app.core.deps import get_current_user, get_db, require_permission
from app.core.email import send_notification_email
from app.models.activity_log import ActivityLog
from app.models.task import Task
from app.models.user import User
from app.schemas.task import (
    TaskCreate,
    TaskRead,
    TaskUpdate,
    TaskUpdateEntry,
    TaskUpdatePost,
)

router = APIRouter()


def _to_task_read(task: Task) -> TaskRead:
    data = TaskRead.model_validate(task)
    data.owner_name = task.owner.full_name if task.owner else None
    return data


@router.get("", response_model=list[TaskRead])
def list_tasks(
    project_id: Optional[uuid.UUID] = None,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> list[TaskRead]:
    query = db.query(Task)
    if project_id is not None:
        query = query.filter(Task.project_id == project_id)
    tasks = query.order_by(Task.created_at.desc()).all()
    return [_to_task_read(t) for t in tasks]


@router.get("/{task_id}", response_model=TaskRead)
def get_task(
    task_id: uuid.UUID,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> TaskRead:
    task = db.get(Task, task_id)
    if not task:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Task not found")
    return _to_task_read(task)


@router.get("/{task_id}/updates", response_model=list[TaskUpdateEntry])
def list_task_updates(
    task_id: uuid.UUID,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> list[TaskUpdateEntry]:
    task = db.get(Task, task_id)
    if not task:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Task not found")

    logs = (
        db.query(ActivityLog)
        .filter(ActivityLog.entity_type == "task", ActivityLog.entity_id == str(task_id))
        .order_by(ActivityLog.created_at.desc())
        .all()
    )
    entries = []
    for log in logs:
        entry = TaskUpdateEntry.model_validate(log)
        entry.user_name = log.user.full_name if log.user else None
        entries.append(entry)
    return entries


@router.post("/{task_id}/updates", response_model=TaskUpdateEntry, status_code=status.HTTP_201_CREATED)
def post_task_update(
    task_id: uuid.UUID,
    payload: TaskUpdatePost,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> TaskUpdateEntry:
    task = db.get(Task, task_id)
    if not task:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Task not found")

    log = ActivityLog(
        project_id=task.project_id,
        user_id=current_user.id,
        action="comment",
        entity_type="task",
        entity_id=str(task_id),
        description=payload.description,
    )
    db.add(log)

    if task.owner_user_id and task.owner_user_id != current_user.id:
        notify_user(
            db,
            user_id=task.owner_user_id,
            type="task_update",
            title=f"New update on: {task.title}",
        )

    db.commit()
    db.refresh(log)

    entry = TaskUpdateEntry.model_validate(log)
    entry.user_name = current_user.full_name
    return entry


@router.get("/{task_id}/hk-comments", response_model=list[TaskUpdateEntry])
def list_task_hk_comments(
    task_id: uuid.UUID,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> list[TaskUpdateEntry]:
    task = db.get(Task, task_id)
    if not task:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Task not found")

    logs = (
        db.query(ActivityLog)
        .filter(ActivityLog.entity_type == "task", ActivityLog.entity_id == str(task_id), ActivityLog.action == "hk_comment")
        .order_by(ActivityLog.created_at.desc())
        .all()
    )
    entries = []
    for log in logs:
        entry = TaskUpdateEntry.model_validate(log)
        entry.user_name = log.user.full_name if log.user else None
        entries.append(entry)
    return entries


@router.post("/{task_id}/hk-comments", response_model=TaskUpdateEntry, status_code=status.HTTP_201_CREATED)
def post_task_hk_comment(
    task_id: uuid.UUID,
    payload: TaskUpdatePost,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> TaskUpdateEntry:
    if current_user.email != "hkotecha@kwale-group.com":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN, detail="Only Harshil can post an HK comment"
        )

    task = db.get(Task, task_id)
    if not task:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Task not found")

    log = ActivityLog(
        project_id=task.project_id,
        user_id=current_user.id,
        action="hk_comment",
        entity_type="task",
        entity_id=str(task_id),
        description=payload.description,
    )
    db.add(log)

    if task.owner_user_id and task.owner_user_id != current_user.id:
        notify_user(
            db,
            user_id=task.owner_user_id,
            type="hk_comment",
            title=f"HK comment on: {task.title}",
        )

    db.commit()
    db.refresh(log)

    entry = TaskUpdateEntry.model_validate(log)
    entry.user_name = current_user.full_name
    return entry


@router.post("", response_model=TaskRead, status_code=status.HTTP_201_CREATED)
def create_task(
    payload: TaskCreate,
    background_tasks: BackgroundTasks,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_permission("tasks.edit")),
) -> TaskRead:
    task = Task(**payload.model_dump())
    db.add(task)
    db.flush()
    log_activity(
        db,
        user_id=current_user.id,
        action="create",
        entity_type="task",
        entity_id=str(task.id),
        project_id=task.project_id,
        description=f"Created task '{task.title}'",
    )
    if task.owner_user_id and task.owner_user_id != current_user.id:
        notify_user(
            db,
            user_id=task.owner_user_id,
            type="task_assigned",
            title=f"You were assigned: {task.title}",
        )
        owner = db.get(User, task.owner_user_id)
        if owner:
            background_tasks.add_task(
                send_notification_email,
                owner.email,
                f"Task assigned: {task.title}",
                f"{current_user.full_name} assigned you a task: <strong>{task.title}</strong>",
            )
    db.commit()
    db.refresh(task)
    return _to_task_read(task)


@router.put("/{task_id}", response_model=TaskRead)
def update_task(
    task_id: uuid.UUID,
    payload: TaskUpdate,
    background_tasks: BackgroundTasks,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_permission("tasks.edit")),
) -> TaskRead:
    task = db.get(Task, task_id)
    if not task:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Task not found")

    previous_owner_id = task.owner_user_id

    for field, value in payload.model_dump(exclude_unset=True).items():
        setattr(task, field, value)

    log_activity(
        db,
        user_id=current_user.id,
        action="update",
        entity_type="task",
        entity_id=str(task.id),
        project_id=task.project_id,
        description=f"Updated task '{task.title}'",
    )
    if (
        task.owner_user_id
        and task.owner_user_id != previous_owner_id
        and task.owner_user_id != current_user.id
    ):
        notify_user(
            db,
            user_id=task.owner_user_id,
            type="task_assigned",
            title=f"You were assigned: {task.title}",
        )
        owner = db.get(User, task.owner_user_id)
        if owner:
            background_tasks.add_task(
                send_notification_email,
                owner.email,
                f"Task assigned: {task.title}",
                f"{current_user.full_name} assigned you a task: <strong>{task.title}</strong>",
            )

    db.commit()
    db.refresh(task)
    return _to_task_read(task)


@router.delete("/{task_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_task(
    task_id: uuid.UUID,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_permission("tasks.edit")),
) -> None:
    task = db.get(Task, task_id)
    if not task:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Task not found")
    log_activity(
        db,
        user_id=current_user.id,
        action="delete",
        entity_type="task",
        entity_id=str(task.id),
        project_id=task.project_id,
        description=f"Deleted task '{task.title}'",
    )
    db.delete(task)
    db.commit()
