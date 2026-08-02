import uuid
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.core.audit import log_activity, notify_user
from app.core.deps import get_current_user, get_db, require_permission
from app.models.document import Document
from app.models.project_participant import ProjectParticipant
from app.models.user import User
from app.schemas.document import DocumentCreate, DocumentRead, DocumentUpdate

router = APIRouter()


@router.get("", response_model=list[DocumentRead])
def list_documents(
    project_id: Optional[uuid.UUID] = None,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> list[Document]:
    query = db.query(Document)
    if project_id is not None:
        query = query.filter(Document.project_id == project_id)
    return query.order_by(Document.created_at.desc()).all()


@router.get("/{document_id}", response_model=DocumentRead)
def get_document(
    document_id: uuid.UUID,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> Document:
    document = db.get(Document, document_id)
    if not document:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Document not found")
    return document


@router.post("", response_model=DocumentRead, status_code=status.HTTP_201_CREATED)
def create_document(
    payload: DocumentCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_permission("documents.edit")),
) -> Document:
    document = Document(**payload.model_dump(), uploaded_by_user_id=current_user.id)
    db.add(document)
    db.flush()
    log_activity(
        db,
        user_id=current_user.id,
        action="create",
        entity_type="document",
        entity_id=str(document.id),
        project_id=document.project_id,
        organization_id=document.organization_id,
        description=f"Uploaded document '{document.name}'",
    )

    if document.project_id is not None:
        participant_user_ids = (
            db.query(ProjectParticipant.user_id)
            .filter(
                ProjectParticipant.project_id == document.project_id,
                ProjectParticipant.user_id.isnot(None),
                ProjectParticipant.user_id != current_user.id,
            )
            .distinct()
            .all()
        )
        for (user_id,) in participant_user_ids:
            notify_user(
                db,
                user_id=user_id,
                type="document_uploaded",
                title=f"New document: {document.name}",
            )

    db.commit()
    db.refresh(document)
    return document


@router.put("/{document_id}", response_model=DocumentRead)
def update_document(
    document_id: uuid.UUID,
    payload: DocumentUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_permission("documents.edit")),
) -> Document:
    document = db.get(Document, document_id)
    if not document:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Document not found")

    data = payload.model_dump(exclude_unset=True)
    if "file_url" in data and data["file_url"] != document.file_url:
        document.version += 1
    for field, value in data.items():
        setattr(document, field, value)

    log_activity(
        db,
        user_id=current_user.id,
        action="update",
        entity_type="document",
        entity_id=str(document.id),
        project_id=document.project_id,
        organization_id=document.organization_id,
        description=f"Updated document '{document.name}'",
    )

    db.commit()
    db.refresh(document)
    return document


@router.delete("/{document_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_document(
    document_id: uuid.UUID,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_permission("documents.edit")),
) -> None:
    document = db.get(Document, document_id)
    if not document:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Document not found")
    log_activity(
        db,
        user_id=current_user.id,
        action="delete",
        entity_type="document",
        entity_id=str(document.id),
        project_id=document.project_id,
        organization_id=document.organization_id,
        description=f"Deleted document '{document.name}'",
    )
    db.delete(document)
    db.commit()
