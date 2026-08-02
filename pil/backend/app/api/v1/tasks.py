"""Task/Kanban, milestone, and announcement endpoints (API Specification doc "Task
Management")."""

from __future__ import annotations

import uuid

from fastapi import APIRouter, Depends, File, Form, Query, Request, UploadFile
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import Settings, get_settings
from app.core.deps import (
    get_current_claims,
    get_project_scoped_session,
    get_scanner,
    get_storage,
    get_task_scoped_session,
    require_project_permission,
    require_task_permission,
)
from app.core.errors import PermissionDeniedError, RateLimitedError, ResourceNotFoundError
from app.core.rate_limit import RateLimiter
from app.core.security.jwt import AccessTokenClaims
from app.repositories import task_repository, user_repository
from app.schemas.task import (
    AnnouncementCreateRequest,
    AnnouncementResponse,
    MilestoneCreateRequest,
    MilestoneResponse,
    TaskAttachmentRequest,
    TaskCommentAttachmentResponse,
    TaskCommentCreateRequest,
    TaskCommentResponse,
    TaskCreateRequest,
    TaskHkCommentRequest,
    TaskResponse,
    TaskUpdateRequest,
)
from app.services import document_service, task_service
from app.services.rbac_service import user_has_project_permission
from app.services.task_service import NOT_PROVIDED

router = APIRouter(tags=["tasks"])


def _to_response(task, latest_comment=None) -> TaskResponse:
    return TaskResponse(
        id=str(task.id),
        project_id=str(task.project_id),
        title=task.title,
        description=task.description,
        status=task.status,
        priority=task.priority,
        category=task.category,
        latest_update=latest_comment.body if latest_comment else None,
        latest_update_at=latest_comment.created_at if latest_comment else None,
        hk_comment=task.hk_comment,
        hk_comment_at=task.hk_comment_at,
        assignee_id=str(task.assignee_id) if task.assignee_id else None,
        due_date=task.due_date,
        milestone_id=str(task.milestone_id) if task.milestone_id else None,
        created_by=str(task.created_by),
        created_at=task.created_at,
    )


def _comment_to_response(comment) -> TaskCommentResponse:
    attachment = None
    if comment.attachment_document_id:
        attachment = TaskCommentAttachmentResponse(
            document_id=str(comment.attachment_document_id),
            filename=comment.attachment_filename or "attachment",
            mime_type=comment.attachment_mime_type or "application/octet-stream",
            size_bytes=comment.attachment_size_bytes or 0,
        )
    return TaskCommentResponse(
        id=str(comment.id),
        task_id=str(comment.task_id),
        author_id=str(comment.author_id),
        body=comment.body,
        created_at=comment.created_at,
        attachment=attachment,
    )


@router.post("/projects/{project_id}/tasks", response_model=TaskResponse, status_code=201)
async def create_task(
    project_id: uuid.UUID,
    body: TaskCreateRequest,
    request: Request,
    claims: AccessTokenClaims = Depends(require_project_permission("task.create")),
    session: AsyncSession = Depends(get_project_scoped_session),
) -> TaskResponse:
    organization_id = request.state.resolved_organization_id
    task = await task_service.create_task(
        session,
        project_id=project_id,
        organization_id=organization_id,
        title=body.title,
        description=body.description,
        priority=body.priority,
        category=body.category,
        assignee_id=uuid.UUID(body.assignee_id) if body.assignee_id else None,
        due_date=body.due_date,
        milestone_id=uuid.UUID(body.milestone_id) if body.milestone_id else None,
        created_by=uuid.UUID(claims.sub),
    )
    return _to_response(task)


@router.get("/projects/{project_id}/tasks", response_model=list[TaskResponse])
async def list_tasks(
    project_id: uuid.UUID,
    status: str | None = Query(default=None),
    assignee: uuid.UUID | None = Query(default=None),
    session: AsyncSession = Depends(get_project_scoped_session),
) -> list[TaskResponse]:
    tasks = await task_repository.list_for_project(session, project_id, status=status, assignee_id=assignee)
    latest_by_task = await task_repository.get_latest_comments(session, [t.id for t in tasks])
    return [_to_response(t, latest_by_task.get(t.id)) for t in tasks]


@router.get("/tasks/{task_id}", response_model=TaskResponse)
async def get_task(task_id: uuid.UUID, session: AsyncSession = Depends(get_task_scoped_session)) -> TaskResponse:
    task = await task_repository.get_by_id(session, task_id)
    if task is None:
        raise ResourceNotFoundError()
    return _to_response(task)


@router.patch("/tasks/{task_id}", response_model=TaskResponse)
async def update_task(
    task_id: uuid.UUID,
    body: TaskUpdateRequest,
    request: Request,
    claims: AccessTokenClaims = Depends(require_task_permission("task.update")),
    session: AsyncSession = Depends(get_task_scoped_session),
    settings: Settings = Depends(get_settings),
) -> TaskResponse:
    project_id = request.state.resolved_project_id

    if body.status == "done" and settings.task_approver_alias:
        current = await task_repository.get_by_id(session, task_id)
        if current is not None and current.status != "done":
            actor = await user_repository.get_by_id(session, uuid.UUID(claims.sub))
            if actor is None or actor.alias.lower() != settings.task_approver_alias.lower():
                raise PermissionDeniedError(
                    f"Only {settings.task_approver_alias} can mark a task Resolved"
                )

    task = await task_service.update_task(
        session,
        task_id=task_id,
        project_id=project_id,
        title=body.title,
        description=body.description,
        priority=body.priority,
        new_status=body.status,
        category=(None if body.clear_category else (body.category if body.category else NOT_PROVIDED)),
        assignee_id=(None if body.clear_assignee else (uuid.UUID(body.assignee_id) if body.assignee_id else NOT_PROVIDED)),
        due_date=(None if body.clear_due_date else (body.due_date if body.due_date else NOT_PROVIDED)),
        milestone_id=(None if body.clear_milestone else (uuid.UUID(body.milestone_id) if body.milestone_id else NOT_PROVIDED)),
        updated_by=uuid.UUID(claims.sub),
    )
    latest_by_task = await task_repository.get_latest_comments(session, [task.id])
    return _to_response(task, latest_by_task.get(task.id))


@router.delete("/tasks/{task_id}", status_code=204)
async def delete_task(
    task_id: uuid.UUID,
    request: Request,
    claims: AccessTokenClaims = Depends(get_current_claims),
    session: AsyncSession = Depends(get_task_scoped_session),
) -> None:
    organization_id = request.state.resolved_organization_id
    project_id = request.state.resolved_project_id
    user_id = uuid.UUID(claims.sub)

    can_delete_any = await user_has_project_permission(
        session, user_id=user_id, project_id=project_id, organization_id=organization_id, permission_code="task.delete"
    )
    await task_service.delete_task(session, task_id=task_id, deleter_id=user_id, can_delete_any=can_delete_any)


@router.post("/tasks/{task_id}/comments", response_model=TaskCommentResponse, status_code=201)
async def add_comment(
    task_id: uuid.UUID,
    body: TaskCommentCreateRequest,
    claims: AccessTokenClaims = Depends(require_task_permission("task.comment")),
    session: AsyncSession = Depends(get_task_scoped_session),
) -> TaskCommentResponse:
    comment = await task_service.add_comment(session, task_id=task_id, author_id=uuid.UUID(claims.sub), body=body.body)
    return _comment_to_response(comment)


@router.get("/tasks/{task_id}/comments", response_model=list[TaskCommentResponse])
async def list_comments(
    task_id: uuid.UUID, session: AsyncSession = Depends(get_task_scoped_session)
) -> list[TaskCommentResponse]:
    comments = await task_repository.list_comments(session, task_id)
    return [_comment_to_response(c) for c in comments]


@router.post("/tasks/{task_id}/comments/attachment", response_model=TaskCommentResponse, status_code=201)
async def add_comment_with_attachment(
    task_id: uuid.UUID,
    request: Request,
    file: UploadFile = File(...),
    body: str = Form(default=""),
    claims: AccessTokenClaims = Depends(require_task_permission("task.comment")),
    session: AsyncSession = Depends(get_task_scoped_session),
    settings: Settings = Depends(get_settings),
    storage=Depends(get_storage),
    scanner=Depends(get_scanner),
) -> TaskCommentResponse:
    limiter = RateLimiter(request.app.state.redis)
    rate_result = await limiter.check(
        f"document-upload:{claims.sub}", limit=settings.document_upload_rate_limit_per_minute, window_seconds=60
    )
    if not rate_result.allowed:
        raise RateLimitedError()

    filename = file.filename or "unnamed"
    data = await file.read(settings.max_upload_bytes + 1)
    if len(data) > settings.max_upload_bytes:
        raise document_service.DocumentValidationError("File exceeds maximum upload size")

    project_id = request.state.resolved_project_id
    organization_id = request.state.resolved_organization_id
    comment = await task_service.add_comment_with_attachment(
        session, settings, storage, scanner,
        task_id=task_id, project_id=project_id, organization_id=organization_id,
        author_id=uuid.UUID(claims.sub), body=body.strip() or f"📎 {filename}",
        filename=filename, mime_type=file.content_type or "application/octet-stream", data=data,
    )
    return _comment_to_response(comment)


@router.put("/tasks/{task_id}/hk-comment", response_model=TaskResponse)
async def set_hk_comment(
    task_id: uuid.UUID,
    body: TaskHkCommentRequest,
    claims: AccessTokenClaims = Depends(require_task_permission("task.comment")),
    session: AsyncSession = Depends(get_task_scoped_session),
    settings: Settings = Depends(get_settings),
) -> TaskResponse:
    # Same config-driven single-user gate as "only Harshil can mark a task Resolved"
    # in update_task — deliberately not a role in the permission matrix (see that
    # comment for why).
    if settings.task_approver_alias:
        actor = await user_repository.get_by_id(session, uuid.UUID(claims.sub))
        if actor is None or actor.alias.lower() != settings.task_approver_alias.lower():
            raise PermissionDeniedError(f"Only {settings.task_approver_alias} can post this comment")

    task = await task_service.set_hk_comment(session, task_id=task_id, body=body.body)
    latest_by_task = await task_repository.get_latest_comments(session, [task.id])
    return _to_response(task, latest_by_task.get(task.id))


@router.post("/tasks/{task_id}/attachments", status_code=204)
async def add_attachment(
    task_id: uuid.UUID,
    body: TaskAttachmentRequest,
    request: Request,
    claims: AccessTokenClaims = Depends(require_task_permission("task.update")),
    session: AsyncSession = Depends(get_task_scoped_session),
) -> None:
    project_id = request.state.resolved_project_id
    await task_service.add_attachment(
        session, task_id=task_id, project_id=project_id, document_id=uuid.UUID(body.document_id), added_by=uuid.UUID(claims.sub)
    )


@router.get("/projects/{project_id}/milestones", response_model=list[MilestoneResponse])
async def list_milestones(
    project_id: uuid.UUID, session: AsyncSession = Depends(get_project_scoped_session)
) -> list[MilestoneResponse]:
    milestones = await task_repository.list_milestones(session, project_id)
    return [MilestoneResponse.model_validate(m) for m in milestones]


@router.post("/projects/{project_id}/milestones", response_model=MilestoneResponse, status_code=201)
async def create_milestone(
    project_id: uuid.UUID,
    body: MilestoneCreateRequest,
    request: Request,
    claims: AccessTokenClaims = Depends(require_project_permission("milestone.create")),
    session: AsyncSession = Depends(get_project_scoped_session),
) -> MilestoneResponse:
    organization_id = request.state.resolved_organization_id
    milestone = await task_repository.create_milestone(
        session, project_id=project_id, organization_id=organization_id, name=body.name, due_date=body.due_date,
        created_by=uuid.UUID(claims.sub),
    )
    return MilestoneResponse.model_validate(milestone)


@router.get("/projects/{project_id}/announcements", response_model=list[AnnouncementResponse])
async def list_announcements(
    project_id: uuid.UUID, session: AsyncSession = Depends(get_project_scoped_session)
) -> list[AnnouncementResponse]:
    announcements = await task_repository.list_announcements(session, project_id)
    return [AnnouncementResponse.model_validate(a) for a in announcements]


@router.post("/projects/{project_id}/announcements", response_model=AnnouncementResponse, status_code=201)
async def create_announcement(
    project_id: uuid.UUID,
    body: AnnouncementCreateRequest,
    request: Request,
    claims: AccessTokenClaims = Depends(require_project_permission("announcement.create")),
    session: AsyncSession = Depends(get_project_scoped_session),
) -> AnnouncementResponse:
    organization_id = request.state.resolved_organization_id
    announcement = await task_repository.create_announcement(
        session, project_id=project_id, organization_id=organization_id, author_id=uuid.UUID(claims.sub),
        title=body.title, body=body.body,
    )
    return AnnouncementResponse.model_validate(announcement)
