import uuid

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.core.audit import log_activity
from app.core.deps import get_current_user, get_db, require_permission
from app.models.drawing import Drawing, DrawingComment
from app.models.user import User
from app.schemas.drawing import (
    DrawingCommentCreate,
    DrawingCommentRead,
    DrawingCreate,
    DrawingDetailRead,
    DrawingRead,
    DrawingUpdate,
)

router = APIRouter()


@router.get("/drawings", response_model=list[DrawingRead])
def list_drawings(
    project_id: uuid.UUID,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> list[Drawing]:
    return (
        db.query(Drawing)
        .filter(Drawing.project_id == project_id)
        .order_by(Drawing.created_at.desc())
        .all()
    )


@router.post("/drawings", response_model=DrawingRead, status_code=status.HTTP_201_CREATED)
def create_drawing(
    payload: DrawingCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_permission("engineering.edit")),
) -> Drawing:
    drawing = Drawing(**payload.model_dump(), uploaded_by_user_id=current_user.id)
    db.add(drawing)
    db.flush()
    log_activity(
        db,
        user_id=current_user.id,
        action="create",
        entity_type="drawing",
        entity_id=str(drawing.id),
        project_id=drawing.project_id,
        description=f"Uploaded drawing '{drawing.title}'",
    )
    db.commit()
    db.refresh(drawing)
    return drawing


@router.get("/drawings/{drawing_id}", response_model=DrawingDetailRead)
def get_drawing(
    drawing_id: uuid.UUID,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> Drawing:
    drawing = db.get(Drawing, drawing_id)
    if not drawing:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Drawing not found")
    return drawing


@router.put("/drawings/{drawing_id}", response_model=DrawingRead)
def update_drawing(
    drawing_id: uuid.UUID,
    payload: DrawingUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_permission("engineering.edit")),
) -> Drawing:
    drawing = db.get(Drawing, drawing_id)
    if not drawing:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Drawing not found")

    for field, value in payload.model_dump(exclude_unset=True).items():
        setattr(drawing, field, value)

    log_activity(
        db,
        user_id=current_user.id,
        action="update",
        entity_type="drawing",
        entity_id=str(drawing.id),
        project_id=drawing.project_id,
        description=f"Updated drawing '{drawing.title}'",
    )
    db.commit()
    db.refresh(drawing)
    return drawing


@router.delete("/drawings/{drawing_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_drawing(
    drawing_id: uuid.UUID,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_permission("engineering.edit")),
) -> None:
    drawing = db.get(Drawing, drawing_id)
    if not drawing:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Drawing not found")
    log_activity(
        db,
        user_id=current_user.id,
        action="delete",
        entity_type="drawing",
        entity_id=str(drawing.id),
        project_id=drawing.project_id,
        description=f"Deleted drawing '{drawing.title}'",
    )
    db.delete(drawing)
    db.commit()


@router.post(
    "/drawings/{drawing_id}/comments",
    response_model=DrawingCommentRead,
    status_code=status.HTTP_201_CREATED,
)
def create_drawing_comment(
    drawing_id: uuid.UUID,
    payload: DrawingCommentCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_permission("engineering.edit")),
) -> DrawingComment:
    drawing = db.get(Drawing, drawing_id)
    if not drawing:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Drawing not found")
    comment = DrawingComment(drawing_id=drawing_id, user_id=current_user.id, **payload.model_dump())
    db.add(comment)
    db.flush()
    log_activity(
        db,
        user_id=current_user.id,
        action="create",
        entity_type="drawing_comment",
        entity_id=str(comment.id),
        project_id=drawing.project_id,
        description=f"Commented on drawing '{drawing.title}'",
    )
    db.commit()
    db.refresh(comment)
    return comment
