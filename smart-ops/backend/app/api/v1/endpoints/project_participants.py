import uuid

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.core.audit import log_activity
from app.core.deps import get_current_user, get_db, require_permission
from app.models.project_participant import ProjectParticipant
from app.models.user import User
from app.schemas.project_participant import ProjectParticipantCreate, ProjectParticipantRead

router = APIRouter()


@router.get("", response_model=list[ProjectParticipantRead])
def list_project_participants(
    project_id: uuid.UUID,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> list[ProjectParticipant]:
    return (
        db.query(ProjectParticipant)
        .filter(ProjectParticipant.project_id == project_id)
        .all()
    )


@router.post("", response_model=ProjectParticipantRead, status_code=status.HTTP_201_CREATED)
def create_project_participant(
    payload: ProjectParticipantCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_permission("projects.edit")),
) -> ProjectParticipant:
    participant = ProjectParticipant(**payload.model_dump())
    db.add(participant)
    db.flush()
    log_activity(
        db,
        user_id=current_user.id,
        action="create",
        entity_type="project_participant",
        entity_id=str(participant.id),
        project_id=participant.project_id,
        description="Added a project participant",
    )
    db.commit()
    db.refresh(participant)
    return participant


@router.delete("/{participant_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_project_participant(
    participant_id: uuid.UUID,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_permission("projects.edit")),
) -> None:
    participant = db.get(ProjectParticipant, participant_id)
    if not participant:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Project participant not found")
    log_activity(
        db,
        user_id=current_user.id,
        action="delete",
        entity_type="project_participant",
        entity_id=str(participant.id),
        project_id=participant.project_id,
        description="Removed a project participant",
    )
    db.delete(participant)
    db.commit()
