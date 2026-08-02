from __future__ import annotations

import uuid
from datetime import UTC, datetime

from sqlalchemy import select, update
from sqlalchemy.ext.asyncio import AsyncSession

from app.domain.models.notification import Notification


async def create(session: AsyncSession, *, recipient_id: uuid.UUID, type_: str, payload: dict) -> Notification:
    notification = Notification(recipient_id=recipient_id, type=type_, payload=payload)
    session.add(notification)
    await session.flush()
    return notification


async def list_for_user(session: AsyncSession, user_id: uuid.UUID, *, unread_only: bool = False) -> list[Notification]:
    query = select(Notification).where(Notification.recipient_id == user_id)
    if unread_only:
        query = query.where(Notification.read_at.is_(None))
    result = await session.execute(query.order_by(Notification.created_at.desc()).limit(100))
    return list(result.scalars().all())


async def get_by_id(session: AsyncSession, notification_id: uuid.UUID) -> Notification | None:
    result = await session.execute(select(Notification).where(Notification.id == notification_id))
    return result.scalar_one_or_none()


async def mark_read(session: AsyncSession, *, notification_id: uuid.UUID, user_id: uuid.UUID) -> bool:
    result = await session.execute(
        update(Notification)
        .where(Notification.id == notification_id, Notification.recipient_id == user_id, Notification.read_at.is_(None))
        .values(read_at=datetime.now(UTC))
    )
    return result.rowcount > 0


async def mark_all_read(session: AsyncSession, *, user_id: uuid.UUID) -> None:
    await session.execute(
        update(Notification)
        .where(Notification.recipient_id == user_id, Notification.read_at.is_(None))
        .values(read_at=datetime.now(UTC))
    )
