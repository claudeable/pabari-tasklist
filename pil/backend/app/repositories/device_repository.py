from __future__ import annotations

import uuid
from datetime import UTC, datetime

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.domain.models.user import Device


async def get_by_fingerprint(session: AsyncSession, user_id: uuid.UUID, fingerprint: str) -> Device | None:
    result = await session.execute(
        select(Device).where(Device.user_id == user_id, Device.device_fingerprint == fingerprint)
    )
    return result.scalar_one_or_none()


async def get_or_create(session: AsyncSession, user_id: uuid.UUID, fingerprint: str, name: str | None) -> Device:
    device = await get_by_fingerprint(session, user_id, fingerprint)
    if device is not None:
        if device.revoked_at is not None:
            # A previously revoked device re-appearing is treated as untrusted again,
            # not silently reinstated (Authentication Design doc §4).
            device.revoked_at = None
            device.trusted = False
        device.last_seen_at = datetime.now(UTC)
        return device

    device = Device(user_id=user_id, device_fingerprint=fingerprint, device_name=name, trusted=False)
    session.add(device)
    await session.flush()
    return device


async def get_by_id(session: AsyncSession, device_id: uuid.UUID) -> Device | None:
    result = await session.execute(select(Device).where(Device.id == device_id))
    return result.scalar_one_or_none()


async def list_for_user(session: AsyncSession, user_id: uuid.UUID) -> list[Device]:
    result = await session.execute(select(Device).where(Device.user_id == user_id))
    return list(result.scalars().all())


async def revoke(session: AsyncSession, device_id: uuid.UUID) -> None:
    device = await get_by_id(session, device_id)
    if device is not None and device.revoked_at is None:
        device.revoked_at = datetime.now(UTC)
        device.trusted = False
