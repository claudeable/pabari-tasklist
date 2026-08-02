from __future__ import annotations

import uuid

from sqlalchemy import func, or_, select, text
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import aliased

from app.domain.models.chat import Channel, ChannelMember


async def get_organization_id_for_channel(session: AsyncSession, channel_id: uuid.UUID) -> uuid.UUID | None:
    """SECURITY DEFINER-backed lookup, mirrors project_repository's equivalent — see
    that module's docstring and migration 0004 for why a direct SELECT can't be used
    here (channels has FORCE ROW LEVEL SECURITY)."""
    result = await session.execute(
        text("SELECT get_channel_organization_id(:channel_id) AS org_id").bindparams(channel_id=channel_id)
    )
    row = result.first()
    return row.org_id if row and row.org_id is not None else None


async def create(
    session: AsyncSession,
    *,
    project_id: uuid.UUID,
    organization_id: uuid.UUID,
    name: str,
    is_private: bool,
    encrypted_dek: str,
) -> Channel:
    channel = Channel(
        project_id=project_id,
        organization_id=organization_id,
        name=name,
        is_private=is_private,
        encrypted_dek=encrypted_dek,
    )
    session.add(channel)
    await session.flush()
    return channel


async def get_by_id(session: AsyncSession, channel_id: uuid.UUID) -> Channel | None:
    result = await session.execute(select(Channel).where(Channel.id == channel_id))
    return result.scalar_one_or_none()


async def list_for_project(session: AsyncSession, project_id: uuid.UUID) -> list[Channel]:
    result = await session.execute(select(Channel).where(Channel.project_id == project_id))
    return list(result.scalars().all())


async def list_visible_for_user(session: AsyncSession, project_id: uuid.UUID, user_id: uuid.UUID) -> list[Channel]:
    """Non-private channels are org-wide visible; private ones (group-private or
    DM) only show up for an explicit member — this is the app-layer half of DM
    privacy, since RLS on `channels` alone is org-wide, not per-channel."""
    result = await session.execute(
        select(Channel)
        .outerjoin(
            ChannelMember, (ChannelMember.channel_id == Channel.id) & (ChannelMember.user_id == user_id)
        )
        .where(
            Channel.project_id == project_id,
            or_(Channel.is_private.is_(False), ChannelMember.user_id.is_not(None)),
        )
    )
    return list(result.scalars().all())


async def add_member(
    session: AsyncSession, *, channel_id: uuid.UUID, organization_id: uuid.UUID, user_id: uuid.UUID
) -> None:
    existing = await session.execute(
        select(ChannelMember).where(ChannelMember.channel_id == channel_id, ChannelMember.user_id == user_id)
    )
    if existing.scalar_one_or_none() is not None:
        return
    session.add(ChannelMember(channel_id=channel_id, user_id=user_id, organization_id=organization_id))
    await session.flush()


async def is_member(session: AsyncSession, channel_id: uuid.UUID, user_id: uuid.UUID) -> bool:
    result = await session.execute(
        select(ChannelMember).where(ChannelMember.channel_id == channel_id, ChannelMember.user_id == user_id)
    )
    return result.scalar_one_or_none() is not None


async def find_dm_channel(
    session: AsyncSession, *, project_id: uuid.UUID, user_a: uuid.UUID, user_b: uuid.UUID
) -> Channel | None:
    """A DM is modeled as a private channel with EXACTLY these two members — this
    query distinguishes a real 1:1 DM from an arbitrary private group channel that
    both happen to belong to."""
    cm1 = aliased(ChannelMember)
    cm2 = aliased(ChannelMember)
    member_count = (
        select(func.count(ChannelMember.user_id))
        .where(ChannelMember.channel_id == Channel.id)
        .scalar_subquery()
    )
    result = await session.execute(
        select(Channel)
        .join(cm1, cm1.channel_id == Channel.id)
        .join(cm2, cm2.channel_id == Channel.id)
        .where(
            Channel.project_id == project_id,
            Channel.is_private.is_(True),
            cm1.user_id == user_a,
            cm2.user_id == user_b,
            member_count == 2,
        )
    )
    return result.scalars().first()
