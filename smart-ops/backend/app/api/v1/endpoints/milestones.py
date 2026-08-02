import uuid

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.core.audit import log_activity
from app.core.deps import get_current_user, get_db, require_permission
from app.models.milestone import Milestone
from app.models.user import User
from app.schemas.milestone import MilestoneCreate, MilestoneRead, MilestoneUpdate

router = APIRouter()


@router.get("", response_model=list[MilestoneRead])
def list_milestones(
    project_id: uuid.UUID,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> list[Milestone]:
    return (
        db.query(Milestone)
        .filter(Milestone.project_id == project_id)
        .order_by(Milestone.due_date)
        .all()
    )


@router.post("", response_model=MilestoneRead, status_code=status.HTTP_201_CREATED)
def create_milestone(
    payload: MilestoneCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_permission("projects.edit")),
) -> Milestone:
    milestone = Milestone(**payload.model_dump())
    db.add(milestone)
    db.flush()
    log_activity(
        db,
        user_id=current_user.id,
        action="create",
        entity_type="milestone",
        entity_id=str(milestone.id),
        project_id=milestone.project_id,
        description=f"Created milestone '{milestone.title}'",
    )
    db.commit()
    db.refresh(milestone)
    return milestone


@router.put("/{milestone_id}", response_model=MilestoneRead)
def update_milestone(
    milestone_id: uuid.UUID,
    payload: MilestoneUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_permission("projects.edit")),
) -> Milestone:
    milestone = db.get(Milestone, milestone_id)
    if not milestone:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Milestone not found")

    for field, value in payload.model_dump(exclude_unset=True).items():
        setattr(milestone, field, value)

    log_activity(
        db,
        user_id=current_user.id,
        action="update",
        entity_type="milestone",
        entity_id=str(milestone.id),
        project_id=milestone.project_id,
        description=f"Updated milestone '{milestone.title}'",
    )

    db.commit()
    db.refresh(milestone)
    return milestone


@router.delete("/{milestone_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_milestone(
    milestone_id: uuid.UUID,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_permission("projects.edit")),
) -> None:
    milestone = db.get(Milestone, milestone_id)
    if not milestone:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Milestone not found")
    log_activity(
        db,
        user_id=current_user.id,
        action="delete",
        entity_type="milestone",
        entity_id=str(milestone.id),
        project_id=milestone.project_id,
        description=f"Deleted milestone '{milestone.title}'",
    )
    db.delete(milestone)
    db.commit()
