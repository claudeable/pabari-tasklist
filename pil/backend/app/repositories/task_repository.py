from __future__ import annotations

import uuid
from datetime import UTC, date, datetime

from sqlalchemy import select, text
from sqlalchemy.ext.asyncio import AsyncSession

from app.domain.models.task import Announcement, Milestone, Task, TaskAttachment, TaskComment


async def get_organization_id_for_task(session: AsyncSession, task_id: uuid.UUID) -> uuid.UUID | None:
    """SECURITY DEFINER-backed lookup, same pattern as every other scoped resource
    (see migration 0006 and core/deps.py get_task_scoped_session)."""
    result = await session.execute(
        text("SELECT get_task_organization_id(:task_id) AS org_id").bindparams(task_id=task_id)
    )
    row = result.first()
    return row.org_id if row and row.org_id is not None else None


async def create_task(
    session: AsyncSession,
    *,
    project_id: uuid.UUID,
    organization_id: uuid.UUID,
    title: str,
    description: str | None,
    priority: str,
    category: str | None = None,
    assignee_id: uuid.UUID | None,
    due_date: date | None,
    milestone_id: uuid.UUID | None,
    created_by: uuid.UUID,
) -> Task:
    task = Task(
        project_id=project_id,
        organization_id=organization_id,
        title=title,
        description=description,
        priority=priority,
        category=category,
        assignee_id=assignee_id,
        due_date=due_date,
        milestone_id=milestone_id,
        created_by=created_by,
    )
    session.add(task)
    await session.flush()
    return task


async def get_by_id(session: AsyncSession, task_id: uuid.UUID) -> Task | None:
    result = await session.execute(select(Task).where(Task.id == task_id, Task.deleted_at.is_(None)))
    return result.scalar_one_or_none()


async def get_by_id_for_update(session: AsyncSession, task_id: uuid.UUID) -> Task | None:
    """Row-locked read — used before status transitions so two concurrent Kanban drag
    operations on the same task serialize instead of racing (Pentest Checklist §5
    "Business Logic": race condition on task/board state)."""
    result = await session.execute(
        select(Task).where(Task.id == task_id, Task.deleted_at.is_(None)).with_for_update()
    )
    return result.scalar_one_or_none()


async def list_for_project(
    session: AsyncSession, project_id: uuid.UUID, *, status: str | None = None, assignee_id: uuid.UUID | None = None
) -> list[Task]:
    query = select(Task).where(Task.project_id == project_id, Task.deleted_at.is_(None))
    if status is not None:
        query = query.where(Task.status == status)
    if assignee_id is not None:
        query = query.where(Task.assignee_id == assignee_id)
    result = await session.execute(query.order_by(Task.created_at.desc()))
    return list(result.scalars().all())


async def soft_delete(session: AsyncSession, task_id: uuid.UUID) -> None:
    task = await get_by_id(session, task_id)
    if task is not None:
        task.deleted_at = datetime.now(UTC)


async def add_comment(
    session: AsyncSession,
    *,
    task_id: uuid.UUID,
    author_id: uuid.UUID,
    body: str,
    attachment_document_id: uuid.UUID | None = None,
    attachment_filename: str | None = None,
    attachment_mime_type: str | None = None,
    attachment_size_bytes: int | None = None,
) -> TaskComment:
    comment = TaskComment(
        task_id=task_id,
        author_id=author_id,
        body=body,
        attachment_document_id=attachment_document_id,
        attachment_filename=attachment_filename,
        attachment_mime_type=attachment_mime_type,
        attachment_size_bytes=attachment_size_bytes,
    )
    session.add(comment)
    await session.flush()
    return comment


async def set_hk_comment(session: AsyncSession, *, task_id: uuid.UUID, body: str) -> Task | None:
    task = await get_by_id(session, task_id)
    if task is None:
        return None
    task.hk_comment = body
    task.hk_comment_at = datetime.now(UTC)
    return task


async def list_comments(session: AsyncSession, task_id: uuid.UUID) -> list[TaskComment]:
    result = await session.execute(
        select(TaskComment).where(TaskComment.task_id == task_id).order_by(TaskComment.created_at.asc())
    )
    return list(result.scalars().all())


async def get_latest_comments(session: AsyncSession, task_ids: list[uuid.UUID]) -> dict[uuid.UUID, TaskComment]:
    """One row per task_id, the most recent comment only — used for a task list's
    "Latest Update" column, which is the running progress-note feed, not the
    task's static description (those are two different things the UI was
    conflating: description is set once at creation, this changes with every
    update posted)."""
    if not task_ids:
        return {}
    result = await session.execute(
        select(TaskComment)
        .where(TaskComment.task_id.in_(task_ids))
        .order_by(TaskComment.task_id, TaskComment.created_at.desc())
    )
    latest: dict[uuid.UUID, TaskComment] = {}
    for comment in result.scalars().all():
        if comment.task_id not in latest:
            latest[comment.task_id] = comment
    return latest


async def add_attachment(session: AsyncSession, *, task_id: uuid.UUID, document_id: uuid.UUID, added_by: uuid.UUID) -> None:
    session.add(TaskAttachment(task_id=task_id, document_id=document_id, added_by=added_by))


async def list_attachments(session: AsyncSession, task_id: uuid.UUID) -> list[TaskAttachment]:
    result = await session.execute(select(TaskAttachment).where(TaskAttachment.task_id == task_id))
    return list(result.scalars().all())


async def create_milestone(
    session: AsyncSession,
    *,
    project_id: uuid.UUID,
    organization_id: uuid.UUID,
    name: str,
    due_date: date | None,
    created_by: uuid.UUID,
) -> Milestone:
    milestone = Milestone(
        project_id=project_id, organization_id=organization_id, name=name, due_date=due_date, created_by=created_by
    )
    session.add(milestone)
    await session.flush()
    return milestone


async def list_milestones(session: AsyncSession, project_id: uuid.UUID) -> list[Milestone]:
    result = await session.execute(select(Milestone).where(Milestone.project_id == project_id))
    return list(result.scalars().all())


async def get_milestone(session: AsyncSession, milestone_id: uuid.UUID) -> Milestone | None:
    result = await session.execute(select(Milestone).where(Milestone.id == milestone_id))
    return result.scalar_one_or_none()


async def create_announcement(
    session: AsyncSession,
    *,
    project_id: uuid.UUID,
    organization_id: uuid.UUID,
    author_id: uuid.UUID,
    title: str,
    body: str,
) -> Announcement:
    announcement = Announcement(
        project_id=project_id, organization_id=organization_id, author_id=author_id, title=title, body=body
    )
    session.add(announcement)
    await session.flush()
    return announcement


async def list_announcements(session: AsyncSession, project_id: uuid.UUID) -> list[Announcement]:
    result = await session.execute(
        select(Announcement).where(Announcement.project_id == project_id).order_by(Announcement.created_at.desc())
    )
    return list(result.scalars().all())
