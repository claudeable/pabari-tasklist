import uuid
from datetime import datetime, timezone

from fastapi import APIRouter, Depends, File, HTTPException, UploadFile, status
from fastapi.responses import Response
from sqlalchemy.orm import Session

from app.core.deps import get_current_user, get_db
from app.models.project import Project
from app.models.project_update import ProjectUpdate, ProjectUpdateAttachment
from app.models.user import User
from app.schemas.project_update import ProjectUpdateCreate, ProjectUpdateRead

router = APIRouter()

MAX_ATTACHMENT_BYTES = 50 * 1024 * 1024  # 50 MB


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
    result = []
    for u in updates:
        r = ProjectUpdateRead.model_validate(u)
        r.user_name = u.user.full_name if u.user else None
        result.append(r)
    return result


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
    )
    db.add(update)
    db.commit()
    db.refresh(update)

    result = ProjectUpdateRead.model_validate(update)
    result.user_name = current_user.full_name
    return result


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

    result = ProjectUpdateRead.model_validate(update)
    result.user_name = update.user.full_name if update.user else None
    return result


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
