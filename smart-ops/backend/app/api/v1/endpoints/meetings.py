import uuid
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.core.audit import log_activity, notify_user
from app.core.deps import get_current_user, get_db, require_permission
from app.models.meeting import Meeting
from app.models.project_participant import ProjectParticipant
from app.models.user import User
from app.schemas.meeting import MeetingCreate, MeetingRead, MeetingUpdate

router = APIRouter()


@router.get("", response_model=list[MeetingRead])
def list_meetings(
    project_id: Optional[uuid.UUID] = None,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> list[Meeting]:
    query = db.query(Meeting)
    if project_id is not None:
        query = query.filter(Meeting.project_id == project_id)
    return query.order_by(Meeting.scheduled_at.desc().nullslast()).all()


@router.get("/{meeting_id}", response_model=MeetingRead)
def get_meeting(
    meeting_id: uuid.UUID,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> Meeting:
    meeting = db.get(Meeting, meeting_id)
    if not meeting:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Meeting not found")
    return meeting


@router.post("", response_model=MeetingRead, status_code=status.HTTP_201_CREATED)
def create_meeting(
    payload: MeetingCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_permission("meetings.edit")),
) -> Meeting:
    meeting = Meeting(**payload.model_dump())
    db.add(meeting)
    db.flush()
    log_activity(
        db,
        user_id=current_user.id,
        action="create",
        entity_type="meeting",
        entity_id=str(meeting.id),
        project_id=meeting.project_id,
        description=f"Scheduled meeting '{meeting.title}'",
    )

    participant_user_ids = (
        db.query(ProjectParticipant.user_id)
        .filter(
            ProjectParticipant.project_id == meeting.project_id,
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
            type="meeting_scheduled",
            title=f"Meeting scheduled: {meeting.title}",
        )

    db.commit()
    db.refresh(meeting)
    return meeting


@router.put("/{meeting_id}", response_model=MeetingRead)
def update_meeting(
    meeting_id: uuid.UUID,
    payload: MeetingUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_permission("meetings.edit")),
) -> Meeting:
    meeting = db.get(Meeting, meeting_id)
    if not meeting:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Meeting not found")

    for field, value in payload.model_dump(exclude_unset=True).items():
        setattr(meeting, field, value)

    log_activity(
        db,
        user_id=current_user.id,
        action="update",
        entity_type="meeting",
        entity_id=str(meeting.id),
        project_id=meeting.project_id,
        description=f"Updated meeting '{meeting.title}'",
    )

    db.commit()
    db.refresh(meeting)
    return meeting


@router.delete("/{meeting_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_meeting(
    meeting_id: uuid.UUID,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_permission("meetings.edit")),
) -> None:
    meeting = db.get(Meeting, meeting_id)
    if not meeting:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Meeting not found")
    log_activity(
        db,
        user_id=current_user.id,
        action="delete",
        entity_type="meeting",
        entity_id=str(meeting.id),
        project_id=meeting.project_id,
        description=f"Deleted meeting '{meeting.title}'",
    )
    db.delete(meeting)
    db.commit()
