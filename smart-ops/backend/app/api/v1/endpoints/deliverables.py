import uuid

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.core.audit import log_activity
from app.core.deps import get_current_user, get_db, require_permission
from app.models.deliverable import Deliverable
from app.models.user import User
from app.schemas.deliverable import DeliverableCreate, DeliverableRead, DeliverableUpdate

router = APIRouter()


@router.get("", response_model=list[DeliverableRead])
def list_deliverables(
    project_id: uuid.UUID,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> list[Deliverable]:
    return (
        db.query(Deliverable)
        .filter(Deliverable.project_id == project_id)
        .order_by(Deliverable.due_date)
        .all()
    )


@router.post("", response_model=DeliverableRead, status_code=status.HTTP_201_CREATED)
def create_deliverable(
    payload: DeliverableCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_permission("projects.edit")),
) -> Deliverable:
    deliverable = Deliverable(**payload.model_dump())
    db.add(deliverable)
    db.flush()
    log_activity(
        db,
        user_id=current_user.id,
        action="create",
        entity_type="deliverable",
        entity_id=str(deliverable.id),
        project_id=deliverable.project_id,
        description=f"Created deliverable '{deliverable.title}'",
    )
    db.commit()
    db.refresh(deliverable)
    return deliverable


@router.put("/{deliverable_id}", response_model=DeliverableRead)
def update_deliverable(
    deliverable_id: uuid.UUID,
    payload: DeliverableUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_permission("projects.edit")),
) -> Deliverable:
    deliverable = db.get(Deliverable, deliverable_id)
    if not deliverable:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Deliverable not found")

    for field, value in payload.model_dump(exclude_unset=True).items():
        setattr(deliverable, field, value)

    log_activity(
        db,
        user_id=current_user.id,
        action="update",
        entity_type="deliverable",
        entity_id=str(deliverable.id),
        project_id=deliverable.project_id,
        description=f"Updated deliverable '{deliverable.title}'",
    )

    db.commit()
    db.refresh(deliverable)
    return deliverable


@router.delete("/{deliverable_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_deliverable(
    deliverable_id: uuid.UUID,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_permission("projects.edit")),
) -> None:
    deliverable = db.get(Deliverable, deliverable_id)
    if not deliverable:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Deliverable not found")
    log_activity(
        db,
        user_id=current_user.id,
        action="delete",
        entity_type="deliverable",
        entity_id=str(deliverable.id),
        project_id=deliverable.project_id,
        description=f"Deleted deliverable '{deliverable.title}'",
    )
    db.delete(deliverable)
    db.commit()
