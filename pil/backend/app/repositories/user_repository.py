from __future__ import annotations

import uuid

from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.domain.models.user import PasswordHistory, User


async def get_by_alias(session: AsyncSession, alias: str) -> User | None:
    # Case-insensitive: aliases are meant to be memorable callsigns, not case-sensitive
    # secrets, and "typed it in lowercase" was a real, repeated source of confusing
    # "Authentication required" errors that had nothing to do with the password.
    result = await session.execute(select(User).where(func.lower(User.alias) == alias.lower()))
    return result.scalar_one_or_none()


async def get_by_id(session: AsyncSession, user_id: uuid.UUID) -> User | None:
    result = await session.execute(select(User).where(User.id == user_id))
    return result.scalar_one_or_none()


async def get_by_pabari_email(session: AsyncSession, pabari_email: str) -> User | None:
    """Looks up a PIL user by their Pabari ERP email (set by admin via pabari_email field).
    Used exclusively for SSO — a nil result means no account is linked yet."""
    result = await session.execute(
        select(User).where(func.lower(User.pabari_email) == pabari_email.lower())
    )
    return result.scalar_one_or_none()


async def get_by_alias_for_update(session: AsyncSession, alias: str) -> User | None:
    """Row-locking variant of get_by_alias — serializes concurrent login attempts
    against the same account so failed_login_count/locked_until updates can't be lost
    to a lost-update race under a distributed brute-force burst (Pentest Checklist §1)."""
    result = await session.execute(select(User).where(func.lower(User.alias) == alias.lower()).with_for_update())
    return result.scalar_one_or_none()


async def get_by_id_for_update(session: AsyncSession, user_id: uuid.UUID) -> User | None:
    """Row-locking read, used where a check-then-write must be serialized against
    concurrent requests for the same user — e.g. TOTP replay-step validation
    (Pentest Checklist §1: "race condition submitting two codes simultaneously")."""
    result = await session.execute(select(User).where(User.id == user_id).with_for_update())
    return result.scalar_one_or_none()


async def get_recent_password_hashes(
    session: AsyncSession, user_id: uuid.UUID, *, limit: int = 10
) -> list[str]:
    result = await session.execute(
        select(PasswordHistory.password_hash)
        .where(PasswordHistory.user_id == user_id)
        .order_by(PasswordHistory.created_at.desc())
        .limit(limit)
    )
    return list(result.scalars().all())


async def record_password_history(session: AsyncSession, user_id: uuid.UUID, password_hash: str) -> None:
    session.add(PasswordHistory(user_id=user_id, password_hash=password_hash))
