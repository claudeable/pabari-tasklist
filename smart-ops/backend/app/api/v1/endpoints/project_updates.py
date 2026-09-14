import uuid
from datetime import datetime, timezone

from fastapi import APIRouter, Depends, File, HTTPException, UploadFile, status
from fastapi.responses import Response
from sqlalchemy.orm import Session

from app.core.deps import get_current_user, get_db
from app.models.project import Project
from app.models.project_update import ProjectUpdate, ProjectUpdateAttachment, ProjectUpdateComment
from app.models.user import User
from app.schemas.project_update import (
    ProjectUpdateCommentCreate,
    ProjectUpdateCommentRead,
    ProjectUpdateCreate,
    ProjectUpdateEdit,
    ProjectUpdateRead,
)

router = APIRouter()

MAX_ATTACHMENT_BYTES = 50 * 1024 * 1024  # 50 MB


def _build_read(u: ProjectUpdate) -> ProjectUpdateRead:
    r = ProjectUpdateRead.model_validate(u)
    r.user_name = u.user.full_name if u.user else None
    if u.parent:
        r.parent_body_snippet = u.parent.body[:80]
    r.comments = [
        ProjectUpdateCommentRead(
            id=c.id,
            update_id=c.update_id,
            user_id=c.user_id,
            user_name=c.user.full_name if c.user else None,
            body=c.body,
            created_at=c.created_at,
        )
        for c in u.comments
    ]
    return r


@router.get("/projects/{project_id}/updates", response_model=list[ProjectUpdateRead])
def list_project_updates(
    project_id: uuid.UUID,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> list[ProjectUpdateRead]:
    project = db.get(Project, project_id)
    if not project:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Project not found")

    updates = (
        db.query(ProjectUpdate)
        .filter(ProjectUpdate.project_id == project_id)
        .order_by(ProjectUpdate.posted_at.desc())
        .all()
    )
    return [_build_read(u) for u in updates]


@router.post(
    "/projects/{project_id}/updates",
    response_model=ProjectUpdateRead,
    status_code=status.HTTP_201_CREATED,
)
def create_project_update(
    project_id: uuid.UUID,
    payload: ProjectUpdateCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> ProjectUpdateRead:
    project = db.get(Project, project_id)
    if not project:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Project not found")

    posted_at = payload.posted_at or datetime.now(timezone.utc)
    update = ProjectUpdate(
        project_id=project_id,
        user_id=current_user.id,
        body=payload.body,
        source=payload.source,
        email_from=payload.email_from or None,
        email_subject=payload.email_subject or None,
        posted_at=posted_at,
        parent_update_id=payload.parent_update_id or None,
        current_capacity=payload.current_capacity or None,
        project_requirement=payload.project_requirement or None,
        internal_notes=payload.internal_notes or None,
        action_items=payload.action_items or None,
    )
    db.add(update)
    db.commit()
    db.refresh(update)

    return _build_read(update)


@router.put(
    "/projects/{project_id}/updates/{update_id}",
    response_model=ProjectUpdateRead,
)
def edit_project_update(
    project_id: uuid.UUID,
    update_id: uuid.UUID,
    payload: ProjectUpdateEdit,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> ProjectUpdateRead:
    update = db.get(ProjectUpdate, update_id)
    if not update or update.project_id != project_id:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Update not found")

    if payload.body is not None:
        update.body = payload.body
    if payload.posted_at is not None:
        update.posted_at = payload.posted_at
    if payload.email_from is not None:
        update.email_from = payload.email_from or None
    if payload.email_subject is not None:
        update.email_subject = payload.email_subject or None
    if payload.status is not None:
        update.status = payload.status
    if payload.current_capacity is not None:
        update.current_capacity = payload.current_capacity or None
    if payload.project_requirement is not None:
        update.project_requirement = payload.project_requirement or None
    if payload.internal_notes is not None:
        update.internal_notes = payload.internal_notes or None
    if payload.action_items is not None:
        update.action_items = payload.action_items or None

    db.commit()
    db.refresh(update)
    return _build_read(update)


@router.post(
    "/projects/{project_id}/updates/{update_id}/attachments",
    response_model=ProjectUpdateRead,
    status_code=status.HTTP_201_CREATED,
)
def upload_project_update_attachment(
    project_id: uuid.UUID,
    update_id: uuid.UUID,
    file: UploadFile = File(...),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> ProjectUpdateRead:
    update = db.get(ProjectUpdate, update_id)
    if not update or update.project_id != project_id:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Update not found")

    data = file.file.read()
    if len(data) > MAX_ATTACHMENT_BYTES:
        raise HTTPException(
            status_code=status.HTTP_413_REQUEST_ENTITY_TOO_LARGE, detail="Max file size is 50 MB"
        )

    attachment = ProjectUpdateAttachment(
        update_id=update_id,
        filename=file.filename or "attachment",
        file_data=data,
        file_mime_type=file.content_type or "application/octet-stream",
        file_size=len(data),
    )
    db.add(attachment)
    db.commit()
    db.refresh(update)
    return _build_read(update)


ALLOWED_DELETE_EMAILS = {"pmureithi@usm.co.ke", "hkotecha@kwale-group.com"}


@router.delete(
    "/projects/{project_id}/updates/{update_id}",
    status_code=status.HTTP_204_NO_CONTENT,
)
def delete_project_update(
    project_id: uuid.UUID,
    update_id: uuid.UUID,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> None:
    role = current_user.role
    is_admin = role and (
        any(p.code == "admin" for p in role.permissions)
        or "admin" in (role.name or "").lower()
    )
    if current_user.email not in ALLOWED_DELETE_EMAILS and not is_admin:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Not allowed to delete updates")

    update = db.get(ProjectUpdate, update_id)
    if not update or update.project_id != project_id:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Update not found")

    db.delete(update)
    db.commit()


@router.delete(
    "/project-update-attachments/{attachment_id}",
    status_code=status.HTTP_204_NO_CONTENT,
)
def delete_project_update_attachment(
    attachment_id: uuid.UUID,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> None:
    role = current_user.role
    is_admin = role and (
        any(p.code == "admin" for p in role.permissions)
        or "admin" in (role.name or "").lower()
    )
    if current_user.email not in ALLOWED_DELETE_EMAILS and not is_admin:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Not allowed to delete attachments")

    attachment = db.get(ProjectUpdateAttachment, attachment_id)
    if not attachment:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Attachment not found")
    db.delete(attachment)
    db.commit()


@router.patch(
    "/projects/{project_id}/updates/{update_id}/status",
    response_model=ProjectUpdateRead,
)
def set_project_update_status(
    project_id: uuid.UUID,
    update_id: uuid.UUID,
    payload: ProjectUpdateEdit,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> ProjectUpdateRead:
    update = db.get(ProjectUpdate, update_id)
    if not update or update.project_id != project_id:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Update not found")
    if payload.status is not None:
        update.status = payload.status
    db.commit()
    db.refresh(update)
    return _build_read(update)


@router.post(
    "/projects/{project_id}/updates/{update_id}/comments",
    response_model=ProjectUpdateRead,
    status_code=status.HTTP_201_CREATED,
)
def add_project_update_comment(
    project_id: uuid.UUID,
    update_id: uuid.UUID,
    payload: ProjectUpdateCommentCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> ProjectUpdateRead:
    update = db.get(ProjectUpdate, update_id)
    if not update or update.project_id != project_id:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Update not found")
    if not payload.body.strip():
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Comment body required")

    comment = ProjectUpdateComment(
        update_id=update_id,
        user_id=current_user.id,
        body=payload.body.strip(),
    )
    db.add(comment)
    db.commit()
    db.refresh(update)
    return _build_read(update)


@router.get("/project-update-attachments/{attachment_id}/file")
def serve_project_update_attachment(
    attachment_id: uuid.UUID,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> Response:
    attachment = db.get(ProjectUpdateAttachment, attachment_id)
    if not attachment:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Attachment not found")
    return Response(
        content=attachment.file_data,
        media_type=attachment.file_mime_type,
        headers={
            "Content-Disposition": f'attachment; filename="{attachment.filename}"',
            "Content-Length": str(attachment.file_size or len(attachment.file_data)),
        },
    )
