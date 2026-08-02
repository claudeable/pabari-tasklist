"""Admin panel operations (API Specification doc "Admin"; Admin Panel doc). Every
function here is destructive or privilege-sensitive by nature — the API layer gates
all of them behind admin.* system_admin permissions AND MFA step-up
(Authentication Design doc §5), not just a role check."""

from __future__ import annotations

import secrets
import uuid

from sqlalchemy.ext.asyncio import AsyncSession

from app.core.errors import ConflictError, ResourceNotFoundError
from app.core.security.passwords import hash_password
from app.domain.enums import SecurityEventType
from app.domain.models.user import User
from app.repositories import device_repository, organization_repository, session_repository, user_repository
from app.services.security_event_service import record_security_event


def _generate_one_time_password() -> str:
    return secrets.token_urlsafe(24)


async def create_user(
    session: AsyncSession, *, alias: str, system_role: str, created_by: uuid.UUID
) -> tuple[User, str]:
    if await user_repository.get_by_alias(session, alias) is not None:
        raise ConflictError(f"Alias '{alias}' already exists")

    one_time_password = _generate_one_time_password()
    user = User(
        alias=alias,
        password_hash=hash_password(one_time_password),
        system_role=system_role,
        must_change_password=True,
    )
    session.add(user)
    await session.flush()

    await record_security_event(
        session,
        event_type=SecurityEventType.admin_action.value,
        user_id=created_by,
        metadata={"action": "user_created", "target_user_id": str(user.id), "alias": alias},
    )
    return user, one_time_password


async def set_user_status(session: AsyncSession, *, user_id: uuid.UUID, status: str, changed_by: uuid.UUID) -> None:
    user = await user_repository.get_by_id(session, user_id)
    if user is None:
        raise ResourceNotFoundError()
    user.status = status
    if status != "active":
        # Disabling an account must also kill any live sessions immediately — leaving
        # them valid until natural expiry would defeat the point of disabling it.
        await session_repository.revoke_all_for_user(session, user_id)
    await record_security_event(
        session,
        event_type=SecurityEventType.admin_action.value,
        user_id=changed_by,
        metadata={"action": "user_status_changed", "target_user_id": str(user_id), "status": status},
    )


async def reset_password(session: AsyncSession, *, user_id: uuid.UUID, reset_by: uuid.UUID) -> str:
    user = await user_repository.get_by_id(session, user_id)
    if user is None:
        raise ResourceNotFoundError()

    one_time_password = _generate_one_time_password()
    user.password_hash = hash_password(one_time_password)
    user.must_change_password = True
    user.failed_login_count = 0
    user.locked_until = None
    await session_repository.revoke_all_for_user(session, user_id)

    await record_security_event(
        session,
        event_type=SecurityEventType.admin_action.value,
        user_id=reset_by,
        metadata={"action": "password_reset", "target_user_id": str(user_id)},
    )
    return one_time_password


async def reset_mfa(session: AsyncSession, *, user_id: uuid.UUID, reset_by: uuid.UUID) -> None:
    user = await user_repository.get_by_id(session, user_id)
    if user is None:
        raise ResourceNotFoundError()
    user.mfa_enabled = False
    user.totp_secret_encrypted = None
    user.totp_last_step = None
    # Forcing MFA re-enrollment is itself a session-worthy event — the old MFA state
    # (and any session established under it) should not silently persist.
    await session_repository.revoke_all_for_user(session, user_id)

    await record_security_event(
        session,
        event_type=SecurityEventType.admin_action.value,
        user_id=reset_by,
        metadata={"action": "mfa_reset", "target_user_id": str(user_id)},
    )


async def revoke_session(session: AsyncSession, *, session_id: uuid.UUID, revoked_by: uuid.UUID) -> None:
    await session_repository.revoke(session, session_id)
    await record_security_event(
        session,
        event_type=SecurityEventType.admin_action.value,
        user_id=revoked_by,
        metadata={"action": "session_revoked", "session_id": str(session_id)},
    )


async def revoke_device(session: AsyncSession, *, device_id: uuid.UUID, revoked_by: uuid.UUID) -> None:
    device = await device_repository.get_by_id(session, device_id)
    if device is None:
        raise ResourceNotFoundError()
    await device_repository.revoke(session, device_id)
    await session_repository.revoke_all_for_device(session, device_id)
    await record_security_event(
        session,
        event_type=SecurityEventType.admin_action.value,
        user_id=revoked_by,
        metadata={"action": "device_revoked", "device_id": str(device_id)},
    )


async def suspend_organization(session: AsyncSession, *, organization_id: uuid.UUID, suspended_by: uuid.UUID) -> None:
    if await organization_repository.get_by_id(session, organization_id) is None:
        raise ResourceNotFoundError()
    await organization_repository.set_status(session, organization_id=organization_id, status="suspended")
    await record_security_event(
        session,
        event_type=SecurityEventType.admin_action.value,
        user_id=suspended_by,
        organization_id=organization_id,
        metadata={"action": "organization_suspended"},
    )
