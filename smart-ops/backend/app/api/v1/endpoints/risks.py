import uuid

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.core.audit import log_activity, notify_user
from app.core.deps import get_current_user, get_db, require_permission
from app.models.risk import Risk
from app.models.user import User
from app.schemas.risk import RiskCreate, RiskRead, RiskUpdate

router = APIRouter()


@router.get("", response_model=list[RiskRead])
def list_risks(
    project_id: uuid.UUID,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> list[Risk]:
    return (
        db.query(Risk)
        .filter(Risk.project_id == project_id)
        .order_by(Risk.created_at.desc())
        .all()
    )


@router.post("", response_model=RiskRead, status_code=status.HTTP_201_CREATED)
def create_risk(
    payload: RiskCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_permission("projects.edit")),
) -> Risk:
    risk = Risk(**payload.model_dump())
    db.add(risk)
    db.flush()
    log_activity(
        db,
        user_id=current_user.id,
        action="create",
        entity_type="risk",
        entity_id=str(risk.id),
        project_id=risk.project_id,
        description=f"Created risk '{risk.title}'",
    )
    if risk.owner_user_id and risk.owner_user_id != current_user.id:
        notify_user(
            db,
            user_id=risk.owner_user_id,
            type="risk_assigned",
            title=f"Risk assigned: {risk.title}",
        )
    db.commit()
    db.refresh(risk)
    return risk


@router.put("/{risk_id}", response_model=RiskRead)
def update_risk(
    risk_id: uuid.UUID,
    payload: RiskUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_permission("projects.edit")),
) -> Risk:
    risk = db.get(Risk, risk_id)
    if not risk:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Risk not found")

    previous_owner_id = risk.owner_user_id

    for field, value in payload.model_dump(exclude_unset=True).items():
        setattr(risk, field, value)

    log_activity(
        db,
        user_id=current_user.id,
        action="update",
        entity_type="risk",
        entity_id=str(risk.id),
        project_id=risk.project_id,
        description=f"Updated risk '{risk.title}'",
    )
    if (
        risk.owner_user_id
        and risk.owner_user_id != previous_owner_id
        and risk.owner_user_id != current_user.id
    ):
        notify_user(
            db,
            user_id=risk.owner_user_id,
            type="risk_assigned",
            title=f"Risk assigned: {risk.title}",
        )

    db.commit()
    db.refresh(risk)
    return risk


@router.delete("/{risk_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_risk(
    risk_id: uuid.UUID,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_permission("projects.edit")),
) -> None:
    risk = db.get(Risk, risk_id)
    if not risk:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Risk not found")
    log_activity(
        db,
        user_id=current_user.id,
        action="delete",
        entity_type="risk",
        entity_id=str(risk.id),
        project_id=risk.project_id,
        description=f"Deleted risk '{risk.title}'",
    )
    db.delete(risk)
    db.commit()
