"""Task/Kanban, milestones, comments, attachments (Pentest Checklist §5 Business
Logic: status-transition validation and row-locked updates prevent race conditions
and workflow-skipping via direct API calls)."""

from __future__ import annotations

import uuid
from datetime import date
from typing import Any

from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import Settings
from app.core.errors import AppError, PermissionDeniedError, ResourceNotFoundError
from app.core.security.virus_scan import VirusScanner
from app.domain.models.task import is_valid_transition
from app.repositories import document_repository, project_repository, task_repository
from app.services import document_service, notification_service

# Sentinel distinguishing "field omitted from the PATCH body" from "field explicitly
# set to null" — e.g. unassigning a task (assignee_id=null) must be representable
# separately from "assignee_id wasn't in this request at all" (leave unchanged).
NOT_PROVIDED = object()


class TaskValidationError(AppError):
    status_code = 400
    title = "Invalid task operation"


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
):
    if assignee_id is not None:
        await _validate_assignee_is_project_member(session, project_id=project_id, assignee_id=assignee_id)
    if milestone_id is not None:
        await _validate_milestone_belongs_to_project(session, project_id=project_id, milestone_id=milestone_id)

    task = await task_repository.create_task(
        session,
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
    if assignee_id is not None:
        await notification_service.notify_task_assigned(
            session, task_id=task.id, project_id=project_id, assignee_id=assignee_id, assigned_by=created_by
        )
    return task


async def _validate_assignee_is_project_member(session: AsyncSession, *, project_id: uuid.UUID, assignee_id: uuid.UUID) -> None:
    # Prevents assigning a task to someone with no access to the project at all — a
    # business-logic gap that would otherwise leak "this task exists and is assigned
    # to you" to an outsider with no other project visibility.
    membership = await project_repository.get_membership(session, project_id, assignee_id)
    if membership is None:
        raise TaskValidationError("Assignee is not a member of this project")


async def _validate_milestone_belongs_to_project(
    session: AsyncSession, *, project_id: uuid.UUID, milestone_id: uuid.UUID
) -> None:
    milestone = await task_repository.get_milestone(session, milestone_id)
    if milestone is None or milestone.project_id != project_id:
        raise TaskValidationError("Milestone does not belong to this project")


async def update_task(
    session: AsyncSession,
    *,
    task_id: uuid.UUID,
    project_id: uuid.UUID,
    title: str | None,
    description: str | None,
    priority: str | None,
    category: Any = NOT_PROVIDED,
    assignee_id: Any = NOT_PROVIDED,
    due_date: Any = NOT_PROVIDED,
    milestone_id: Any = NOT_PROVIDED,
    new_status: str | None,
    updated_by: uuid.UUID | None = None,
):
    # Row-locked for the duration of this update so two concurrent PATCHes to the same
    # task (e.g. two Kanban drag-and-drop actions firing near-simultaneously) can't
    # race each other into an inconsistent status (Pentest Checklist §5).
    task = await task_repository.get_by_id_for_update(session, task_id)
    if task is None:
        raise ResourceNotFoundError()

    previous_assignee_id = task.assignee_id

    if new_status is not None and new_status != task.status:
        if not is_valid_transition(task.status, new_status):
            raise TaskValidationError(f"Cannot transition task from '{task.status}' to '{new_status}'")
        task.status = new_status

    if title is not None:
        task.title = title
    if description is not None:
        task.description = description
    if priority is not None:
        task.priority = priority
    if category is not NOT_PROVIDED:
        task.category = category

    if assignee_id is not NOT_PROVIDED:
        if assignee_id is not None:
            await _validate_assignee_is_project_member(session, project_id=project_id, assignee_id=assignee_id)
        task.assignee_id = assignee_id
    if due_date is not NOT_PROVIDED:
        task.due_date = due_date
    if milestone_id is not NOT_PROVIDED:
        if milestone_id is not None:
            await _validate_milestone_belongs_to_project(session, project_id=project_id, milestone_id=milestone_id)
        task.milestone_id = milestone_id

    if (
        updated_by is not None
        and task.assignee_id is not None
        and task.assignee_id != previous_assignee_id
    ):
        await notification_service.notify_task_assigned(
            session, task_id=task.id, project_id=project_id, assignee_id=task.assignee_id, assigned_by=updated_by
        )

    return task


async def delete_task(session: AsyncSession, *, task_id: uuid.UUID, deleter_id: uuid.UUID, can_delete_any: bool) -> None:
    task = await task_repository.get_by_id(session, task_id)
    if task is None:
        raise ResourceNotFoundError()
    if task.created_by != deleter_id and not can_delete_any:
        raise PermissionDeniedError("Only the creator or a project admin can delete this task")
    await task_repository.soft_delete(session, task_id)


async def add_comment(session: AsyncSession, *, task_id: uuid.UUID, author_id: uuid.UUID, body: str):
    return await task_repository.add_comment(session, task_id=task_id, author_id=author_id, body=body)


async def add_comment_with_attachment(
    session: AsyncSession,
    settings: Settings,
    storage,
    scanner: VirusScanner,
    *,
    task_id: uuid.UUID,
    project_id: uuid.UUID,
    organization_id: uuid.UUID,
    author_id: uuid.UUID,
    body: str,
    filename: str,
    mime_type: str,
    data: bytes,
):
    document, version = await document_service.upload_document(
        session, settings, storage, scanner,
        project_id=project_id, organization_id=organization_id, folder_path="/task-comments", name=filename,
        filename=filename, mime_type=mime_type, data=data, uploaded_by=author_id,
    )
    await task_repository.add_attachment(session, task_id=task_id, document_id=document.id, added_by=author_id)
    comment = await task_repository.add_comment(
        session,
        task_id=task_id,
        author_id=author_id,
        body=body,
        attachment_document_id=document.id,
        attachment_filename=version.original_filename,
        attachment_mime_type=version.mime_type,
        attachment_size_bytes=version.size_bytes,
    )
    return comment


async def set_hk_comment(session: AsyncSession, *, task_id: uuid.UUID, body: str):
    task = await task_repository.set_hk_comment(session, task_id=task_id, body=body)
    if task is None:
        raise ResourceNotFoundError()
    return task


async def add_attachment(
    session: AsyncSession, *, task_id: uuid.UUID, project_id: uuid.UUID, document_id: uuid.UUID, added_by: uuid.UUID
) -> None:
    document = await document_repository.get_by_id(session, document_id)
    if document is None or document.project_id != project_id:
        # Cross-project attachment attempt — must not silently succeed or leak
        # whether a document with that id exists in a project the caller can't see.
        raise ResourceNotFoundError("Document not found in this project")
    await task_repository.add_attachment(session, task_id=task_id, document_id=document_id, added_by=added_by)
