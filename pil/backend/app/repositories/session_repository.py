from __future__ import annotations

import uuid
from datetime import UTC, datetime

from sqlalchemy import select, update
from sqlalchemy.ext.asyncio import AsyncSession

from app.domain.models.user import Session as SessionModel


async def create(
    session: AsyncSession,
    *,
    user_id: uuid.UUID,
    device_id: uuid.UUID,
    refresh_token_hash: str,
    ip_address: str,
    user_agent: str | None,
    expires_at: datetime,
    rotated_from: uuid.UUID | None = None,
) -> SessionModel:
    row = SessionModel(
        user_id=user_id,
        device_id=device_id,
        refresh_token_hash=refresh_token_hash,
        ip_address=ip_address,
        user_agent=user_agent,
        expires_at=expires_at,
        rotated_from=rotated_from,
    )
    session.add(row)
    await session.flush()
    return row


async def get_by_refresh_hash(session: AsyncSession, refresh_token_hash: str) -> SessionModel | None:
    result = await session.execute(
        select(SessionModel).where(SessionModel.refresh_token_hash == refresh_token_hash)
    )
    return result.scalar_one_or_none()


async def get_by_id(session: AsyncSession, session_id: uuid.UUID) -> SessionModel | None:
    result = await session.execute(select(SessionModel).where(SessionModel.id == session_id))
    return result.scalar_one_or_none()


async def revoke(session: AsyncSession, session_id: uuid.UUID) -> None:
    await session.execute(
        update(SessionModel)
        .where(SessionModel.id == session_id, SessionModel.revoked_at.is_(None))
        .values(revoked_at=datetime.now(UTC))
    )


async def revoke_all_for_user(session: AsyncSession, user_id: uuid.UUID) -> None:
    await session.execute(
        update(SessionModel)
        .where(SessionModel.user_id == user_id, SessionModel.revoked_at.is_(None))
        .values(revoked_at=datetime.now(UTC))
    )


async def revoke_all_for_device(session: AsyncSession, device_id: uuid.UUID) -> None:
    await session.execute(
        update(SessionModel)
        .where(SessionModel.device_id == device_id, SessionModel.revoked_at.is_(None))
        .values(revoked_at=datetime.now(UTC))
    )


async def revoke_chain_from(session: AsyncSession, session_id: uuid.UUID) -> int:
    """Revokes the entire rotation family (Authentication Design doc §5 — refresh-token
    reuse detection): walks both forward (children rotated from this session) and
    backward (ancestors) so a reuse anywhere in the chain kills the whole family, not
    just the one token presented."""
    visited: set[uuid.UUID] = set()
    to_visit = [session_id]
    revoked_count = 0

    while to_visit:
        current_id = to_visit.pop()
        if current_id in visited:
            continue
        visited.add(current_id)

        current = await get_by_id(session, current_id)
        if current is None:
            continue

        if current.revoked_at is None:
            current.revoked_at = datetime.now(UTC)
            revoked_count += 1

        if current.rotated_from is not None:
            to_visit.append(current.rotated_from)

        children = await session.execute(
            select(SessionModel.id).where(SessionModel.rotated_from == current_id)
        )
        to_visit.extend(children.scalars().all())

    return revoked_count


async def list_active_for_user(session: AsyncSession, user_id: uuid.UUID) -> list[SessionModel]:
    result = await session.execute(
        select(SessionModel).where(
            SessionModel.user_id == user_id,
            SessionModel.revoked_at.is_(None),
            SessionModel.expires_at > datetime.now(UTC),
        )
    )
    return list(result.scalars().all())


async def list_all_active(session: AsyncSession, *, limit: int = 200) -> list[SessionModel]:
    """Admin-only view across every user (Admin Panel doc: "View Active Sessions") —
    callers MUST gate this behind admin.sessions.view (Security Architecture §1)."""
    result = await session.execute(
        select(SessionModel)
        .where(SessionModel.revoked_at.is_(None), SessionModel.expires_at > datetime.now(UTC))
        .order_by(SessionModel.issued_at.desc())
        .limit(limit)
    )
    return list(result.scalars().all())
