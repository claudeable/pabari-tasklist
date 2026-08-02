import uuid

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.core.audit import log_activity
from app.core.deps import get_current_user, get_db, require_permission
from app.models.decision import Decision
from app.models.user import User
from app.schemas.decision import DecisionCreate, DecisionRead, DecisionUpdate

router = APIRouter()


@router.get("", response_model=list[DecisionRead])
def list_decisions(
    project_id: uuid.UUID,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> list[Decision]:
    return (
        db.query(Decision)
        .filter(Decision.project_id == project_id)
        .order_by(Decision.decision_date)
        .all()
    )


@router.post("", response_model=DecisionRead, status_code=status.HTTP_201_CREATED)
def create_decision(
    payload: DecisionCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_permission("projects.edit")),
) -> Decision:
    decision = Decision(**payload.model_dump())
    db.add(decision)
    db.flush()
    log_activity(
        db,
        user_id=current_user.id,
        action="create",
        entity_type="decision",
        entity_id=str(decision.id),
        project_id=decision.project_id,
        description=f"Created decision '{decision.title}'",
    )
    db.commit()
    db.refresh(decision)
    return decision


@router.put("/{decision_id}", response_model=DecisionRead)
def update_decision(
    decision_id: uuid.UUID,
    payload: DecisionUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_permission("projects.edit")),
) -> Decision:
    decision = db.get(Decision, decision_id)
    if not decision:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Decision not found")

    for field, value in payload.model_dump(exclude_unset=True).items():
        setattr(decision, field, value)

    log_activity(
        db,
        user_id=current_user.id,
        action="update",
        entity_type="decision",
        entity_id=str(decision.id),
        project_id=decision.project_id,
        description=f"Updated decision '{decision.title}'",
    )

    db.commit()
    db.refresh(decision)
    return decision


@router.delete("/{decision_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_decision(
    decision_id: uuid.UUID,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_permission("projects.edit")),
) -> None:
    decision = db.get(Decision, decision_id)
    if not decision:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Decision not found")
    log_activity(
        db,
        user_id=current_user.id,
        action="delete",
        entity_type="decision",
        entity_id=str(decision.id),
        project_id=decision.project_id,
        description=f"Deleted decision '{decision.title}'",
    )
    db.delete(decision)
    db.commit()
