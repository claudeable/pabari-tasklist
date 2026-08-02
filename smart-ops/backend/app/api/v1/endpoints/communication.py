import uuid

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import or_
from sqlalchemy.orm import Session

from app.core.audit import log_activity, notify_user
from app.core.deps import get_current_user, get_db, require_permission
from app.models.channel import Channel, Message
from app.models.project_participant import ProjectParticipant
from app.models.user import User
from app.schemas.channel import (
    ChannelCreate,
    ChannelRead,
    DirectChannelCreate,
    MessageCreate,
    MessageRead,
)

router = APIRouter()


def _to_channel_read(channel: Channel, current_user: User) -> ChannelRead:
    data = ChannelRead.model_validate(channel)
    if channel.is_direct:
        other = None
        if channel.user_a_id == current_user.id:
            other = channel.user_b
        elif channel.user_b_id == current_user.id:
            other = channel.user_a
        data.other_user_name = other.full_name if other else None
    return data


@router.get("/channels", response_model=list[ChannelRead])
def list_channels(
    project_id: uuid.UUID,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> list[Channel]:
    return (
        db.query(Channel)
        .filter(Channel.project_id == project_id)
        .order_by(Channel.created_at.asc())
        .all()
    )


@router.post("/channels", response_model=ChannelRead, status_code=status.HTTP_201_CREATED)
def create_channel(
    payload: ChannelCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_permission("communication.edit")),
) -> Channel:
    channel = Channel(**payload.model_dump())
    db.add(channel)
    db.flush()
    log_activity(
        db,
        user_id=current_user.id,
        action="create",
        entity_type="channel",
        entity_id=str(channel.id),
        project_id=channel.project_id,
        description=f"Created channel '{channel.name}'",
    )
    db.commit()
    db.refresh(channel)
    return channel


@router.get("/channels/direct", response_model=list[ChannelRead])
def list_direct_channels(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> list[ChannelRead]:
    channels = (
        db.query(Channel)
        .filter(
            Channel.is_direct.is_(True),
            or_(Channel.user_a_id == current_user.id, Channel.user_b_id == current_user.id),
        )
        .order_by(Channel.created_at.desc())
        .all()
    )
    return [_to_channel_read(c, current_user) for c in channels]


@router.post("/channels/direct", response_model=ChannelRead, status_code=status.HTTP_201_CREATED)
def create_direct_channel(
    payload: DirectChannelCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> ChannelRead:
    other_user_id = payload.other_user_id
    if other_user_id == current_user.id:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST, detail="Cannot start a DM with yourself"
        )
    other_user = db.get(User, other_user_id)
    if not other_user:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="User not found")

    id_a, id_b = sorted([str(current_user.id), str(other_user_id)])
    id_a, id_b = uuid.UUID(id_a), uuid.UUID(id_b)

    channel = (
        db.query(Channel)
        .filter(
            Channel.is_direct.is_(True),
            Channel.user_a_id == id_a,
            Channel.user_b_id == id_b,
        )
        .first()
    )
    if not channel:
        channel = Channel(
            name="DM",
            is_direct=True,
            user_a_id=id_a,
            user_b_id=id_b,
        )
        db.add(channel)
        db.flush()
        log_activity(
            db,
            user_id=current_user.id,
            action="create",
            entity_type="channel",
            entity_id=str(channel.id),
            description=f"Started a direct message with {other_user.full_name}",
        )
        db.commit()
        db.refresh(channel)

    return _to_channel_read(channel, current_user)


@router.get("/channels/{channel_id}/messages", response_model=list[MessageRead])
def list_messages(
    channel_id: uuid.UUID,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> list[Message]:
    channel = db.get(Channel, channel_id)
    if not channel:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Channel not found")
    return (
        db.query(Message)
        .filter(Message.channel_id == channel_id)
        .order_by(Message.created_at.asc())
        .all()
    )


@router.post(
    "/channels/{channel_id}/messages",
    response_model=MessageRead,
    status_code=status.HTTP_201_CREATED,
)
def create_message(
    channel_id: uuid.UUID,
    payload: MessageCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_permission("communication.edit")),
) -> Message:
    channel = db.get(Channel, channel_id)
    if not channel:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Channel not found")
    message = Message(channel_id=channel_id, user_id=current_user.id, **payload.model_dump())
    db.add(message)
    db.flush()
    log_activity(
        db,
        user_id=current_user.id,
        action="create",
        entity_type="message",
        entity_id=str(message.id),
        project_id=channel.project_id,
        description=f"Posted a message in '{channel.name}'",
    )

    if channel.is_direct:
        recipient_id = None
        if channel.user_a_id and channel.user_a_id != current_user.id:
            recipient_id = channel.user_a_id
        elif channel.user_b_id and channel.user_b_id != current_user.id:
            recipient_id = channel.user_b_id
        if recipient_id:
            notify_user(
                db,
                user_id=recipient_id,
                type="direct_message",
                title=f"New message from {current_user.full_name}",
            )
    elif channel.project_id:
        participant_user_ids = {
            row[0]
            for row in db.query(ProjectParticipant.user_id)
            .filter(ProjectParticipant.project_id == channel.project_id)
            .all()
            if row[0] and row[0] != current_user.id
        }
        for recipient_id in participant_user_ids:
            notify_user(
                db,
                user_id=recipient_id,
                type="message",
                title=f"New message in {channel.name}",
            )

    db.commit()
    db.refresh(message)
    return message
