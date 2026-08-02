"""Self-service device/session management (Authentication Design doc §4, API Spec
"Users (self)" section). Admin-scoped equivalents land in Phase 6 (Admin Panel)."""

from __future__ import annotations

import uuid
from datetime import UTC

from sqlalchemy.ext.asyncio import AsyncSession

from app.core.errors import ResourceNotFoundError
from app.domain.enums import SecurityEventType
from app.repositories import device_repository, session_repository
from app.services.security_event_service import record_security_event


async def list_devices(session: AsyncSession, *, user_id: uuid.UUID):
    return await device_repository.list_for_user(session, user_id)


async def revoke_device(session: AsyncSession, *, user_id: uuid.UUID, device_id: uuid.UUID) -> None:
    device = await device_repository.get_by_id(session, device_id)
    if device is None:
        raise ResourceNotFoundError()
    if device.user_id != user_id:
        # Never disclose whether the device exists for another user — same error as
        # not-found (Threat Model §3.2, IDOR mitigation).
        raise ResourceNotFoundError()

    from datetime import datetime

    device.revoked_at = datetime.now(UTC)
    await session_repository.revoke_all_for_device(session, device.id)
    await record_security_event(
        session, event_type=SecurityEventType.device_revoked.value, user_id=user_id, metadata={"device_id": str(device_id)}
    )


async def list_active_sessions(session: AsyncSession, *, user_id: uuid.UUID):
    return await session_repository.list_active_for_user(session, user_id)


async def revoke_session(session: AsyncSession, *, user_id: uuid.UUID, session_id: uuid.UUID) -> None:
    target = await session_repository.get_by_id(session, session_id)
    if target is None or target.user_id != user_id:
        raise ResourceNotFoundError()

    await session_repository.revoke(session, session_id)
    await record_security_event(
        session, event_type=SecurityEventType.session_revoked.value, user_id=user_id, metadata={"session_id": str(session_id)}
    )
