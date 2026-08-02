"""Security Testing Plan §2 "Authentication"/"Access Control" re-run scope (Phase 6
gate): admin operations must actually revoke live sessions, not just flip a flag."""

import uuid
from datetime import UTC

import pytest

from app.core.errors import ConflictError, ResourceNotFoundError
from app.core.security.passwords import hash_password, verify_password
from app.domain.models.organization import Organization
from app.domain.models.user import Device, User
from app.domain.models.user import Session as SessionModel
from app.repositories import session_repository
from app.services import admin_service


async def _make_user(session, alias: str) -> User:
    user = User(alias=alias, password_hash=hash_password("original-password-14chars"))
    session.add(user)
    await session.flush()
    return user


async def _make_active_session(session, user: User) -> SessionModel:
    device = Device(user_id=user.id, device_fingerprint="fp-1")
    session.add(device)
    await session.flush()
    from datetime import datetime, timedelta

    row = SessionModel(
        user_id=user.id, device_id=device.id, refresh_token_hash=f"hash-{uuid.uuid4()}", ip_address="127.0.0.1",
        expires_at=datetime.now(UTC) + timedelta(days=7),
    )
    session.add(row)
    await session.flush()
    return row


async def test_create_user_rejects_duplicate_alias(session) -> None:
    await _make_user(session, "Falcon-01")
    await session.commit()

    with pytest.raises(ConflictError):
        await admin_service.create_user(session, alias="Falcon-01", system_role="member", created_by=uuid.uuid4())


async def test_create_user_issues_working_one_time_password(session) -> None:
    actor = await _make_user(session, "Sysadmin-00")
    await session.commit()
    user, one_time_password = await admin_service.create_user(
        session, alias="Atlas-04", system_role="member", created_by=actor.id
    )
    assert user.must_change_password is True
    assert verify_password(one_time_password, user.password_hash) is True


async def test_disable_user_revokes_active_sessions(session) -> None:
    user = await _make_user(session, "Echo-11")
    actor = await _make_user(session, "Sysadmin-01")
    await _make_active_session(session, user)
    await session.commit()

    await admin_service.set_user_status(session, user_id=user.id, status="disabled", changed_by=actor.id)
    await session.commit()

    active = await session_repository.list_active_for_user(session, user.id)
    assert active == []
    assert user.status == "disabled"


async def test_reset_password_forces_change_and_revokes_sessions(session) -> None:
    user = await _make_user(session, "Raven-07")
    actor = await _make_user(session, "Sysadmin-02")
    await _make_active_session(session, user)
    await session.commit()

    new_password = await admin_service.reset_password(session, user_id=user.id, reset_by=actor.id)

    assert user.must_change_password is True
    assert verify_password(new_password, user.password_hash) is True
    assert await session_repository.list_active_for_user(session, user.id) == []


async def test_reset_mfa_clears_secret_and_revokes_sessions(session) -> None:
    user = await _make_user(session, "Vortex-02")
    actor = await _make_user(session, "Sysadmin-03")
    user.mfa_enabled = True
    user.totp_secret_encrypted = "encrypted-blob"
    user.totp_last_step = 12345
    await _make_active_session(session, user)
    await session.commit()

    await admin_service.reset_mfa(session, user_id=user.id, reset_by=actor.id)

    assert user.mfa_enabled is False
    assert user.totp_secret_encrypted is None
    assert user.totp_last_step is None
    assert await session_repository.list_active_for_user(session, user.id) == []


async def test_revoke_session_by_id(session) -> None:
    user = await _make_user(session, "Nomad-08")
    actor = await _make_user(session, "Sysadmin-04")
    live_session = await _make_active_session(session, user)
    await session.commit()

    await admin_service.revoke_session(session, session_id=live_session.id, revoked_by=actor.id)
    assert await session_repository.list_active_for_user(session, user.id) == []


async def test_revoke_device_cascades_to_its_sessions(session) -> None:
    user = await _make_user(session, "Sable-03")
    actor = await _make_user(session, "Sysadmin-05")
    live_session = await _make_active_session(session, user)
    device_id = live_session.device_id
    await session.commit()

    await admin_service.revoke_device(session, device_id=device_id, revoked_by=actor.id)

    from app.repositories import device_repository

    device = await device_repository.get_by_id(session, device_id)
    assert device.revoked_at is not None
    assert await session_repository.list_active_for_user(session, user.id) == []


async def test_revoke_nonexistent_device_raises(session) -> None:
    with pytest.raises(ResourceNotFoundError):
        await admin_service.revoke_device(session, device_id=uuid.uuid4(), revoked_by=uuid.uuid4())


async def test_suspend_organization(session) -> None:
    org = Organization(name="Acme", slug=f"acme-{uuid.uuid4().hex[:8]}")
    session.add(org)
    actor = await _make_user(session, "Sysadmin-06")
    await session.commit()

    await admin_service.suspend_organization(session, organization_id=org.id, suspended_by=actor.id)
    assert org.status == "suspended"


async def test_suspend_nonexistent_organization_raises(session) -> None:
    with pytest.raises(ResourceNotFoundError):
        await admin_service.suspend_organization(session, organization_id=uuid.uuid4(), suspended_by=uuid.uuid4())
