"""In-app notifications (Development Roadmap Phase 6). No email/SMS transport exists
anywhere in this codebase — notifications are strictly in-app, per project scope."""

from __future__ import annotations

import uuid

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.domain.models.chat import ChannelMember
from app.domain.models.notification import Notification
from app.repositories import notification_repository, user_repository


async def notify(session: AsyncSession, *, recipient_id: uuid.UUID, type_: str, payload: dict) -> Notification:
    return await notification_repository.create(session, recipient_id=recipient_id, type_=type_, payload=payload)


async def notify_task_assigned(
    session: AsyncSession, *, task_id: uuid.UUID, project_id: uuid.UUID, assignee_id: uuid.UUID, assigned_by: uuid.UUID
) -> None:
    if assignee_id == assigned_by:
        return  # no need to notify yourself
    await notify(
        session,
        recipient_id=assignee_id,
        type_="task_assigned",
        payload={"task_id": str(task_id), "project_id": str(project_id), "assigned_by": str(assigned_by)},
    )


async def notify_new_message(
    session: AsyncSession,
    *,
    channel_id: uuid.UUID,
    project_id: uuid.UUID,
    message_id: uuid.UUID,
    author_id: uuid.UUID,
    author_alias: str,
    preview: str,
    is_private: bool,
) -> None:
    """Notifies everyone who should see a new message: the other participant for a
    DM, or every other project member for a group channel (group channels are
    org/project-wide visible by design — see channel_repository.list_visible_for_user
    — so "everyone who can see it" is the right recipient set, not just whoever is
    an explicit channel_members row, which only private channels/DMs populate)."""
    from app.repositories import channel_repository, project_repository

    if is_private:
        result = await session.execute(
            select(ChannelMember.user_id).where(ChannelMember.channel_id == channel_id)
        )
        recipient_ids = [uid for (uid,) in result.all() if uid != author_id]
    else:
        members = await project_repository.list_members(session, project_id)
        recipient_ids = [m.user_id for m in members if m.user_id != author_id]

    for recipient_id in recipient_ids:
        await notify(
            session,
            recipient_id=recipient_id,
            type_="new_message",
            payload={
                "channel_id": str(channel_id),
                "message_id": str(message_id),
                "author_id": str(author_id),
                "author_alias": author_alias,
                "preview": preview[:140],
                "is_dm": is_private,
            },
        )


async def notify_mentions(
    session: AsyncSession,
    *,
    aliases: list[str],
    message_id: uuid.UUID,
    channel_id: uuid.UUID,
    project_id: uuid.UUID,
    organization_id: uuid.UUID,
    author_id: uuid.UUID,
) -> None:
    from app.services.rbac_service import user_can_access_project

    for alias in aliases:
        user = await user_repository.get_by_alias(session, alias)
        if user is None or user.id == author_id:
            continue
        # A mention notification is itself a small information disclosure ("this
        # channel/project exists and someone posted in it") — without this check, an
        # outsider could learn that by mentioning any alias they can guess, regardless
        # of whether that user (or the mentioner) has any legitimate access to the
        # project at all. Only notify if the mentioned user currently has access,
        # matching the "no implicit cross-tenant visibility" rule applied everywhere
        # else (Threat Model §2 trust boundary 4).
        if not await user_can_access_project(
            session, user_id=user.id, project_id=project_id, organization_id=organization_id
        ):
            continue
        await notify(
            session,
            recipient_id=user.id,
            type_="mention",
            payload={"message_id": str(message_id), "channel_id": str(channel_id), "author_id": str(author_id)},
        )
