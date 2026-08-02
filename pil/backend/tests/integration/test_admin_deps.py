"""Phase 6 gate: full re-run of Access Control + Authentication — the admin surface
specifically requires BOTH MFA step-up AND the admin.* permission (core/deps.py
require_admin_permission)."""

import uuid

import pytest

from app.core.deps import require_admin_permission
from app.core.errors import PermissionDeniedError
from app.core.security.jwt import AccessTokenClaims
from app.domain.enums import SystemRole
from app.domain.models.user import User


async def _make_user(session, *, system_role: str) -> User:
    from app.core.security.passwords import hash_password

    user = User(alias=f"Test-{uuid.uuid4().hex[:6]}", password_hash=hash_password("x" * 20), system_role=system_role)
    session.add(user)
    await session.flush()
    return user


def _claims(user_id: uuid.UUID, *, mfa: bool) -> AccessTokenClaims:
    return AccessTokenClaims(sub=str(user_id), org_id=None, mfa=mfa, jti="x", exp=9999999999, iat=0)


async def test_system_admin_with_mfa_allowed(session) -> None:
    admin = await _make_user(session, system_role=SystemRole.system_admin.value)
    await session.commit()

    checker = require_admin_permission("admin.users.create")
    result = await checker(claims=_claims(admin.id, mfa=True), session=session)
    assert result.sub == str(admin.id)


async def test_system_admin_without_mfa_denied() -> None:
    """A stolen-but-not-MFA-verified access token must not be enough, even for a
    system_admin account (Authentication Design doc §5 step-up requirement)."""
    checker = require_admin_permission("admin.users.create")
    with pytest.raises(PermissionDeniedError):
        await checker(claims=_claims(uuid.uuid4(), mfa=False), session=None)  # type: ignore[arg-type]


async def test_regular_member_with_mfa_denied(session) -> None:
    member = await _make_user(session, system_role=SystemRole.member.value)
    await session.commit()

    checker = require_admin_permission("admin.users.create")
    with pytest.raises(PermissionDeniedError):
        await checker(claims=_claims(member.id, mfa=True), session=session)


async def test_nonexistent_user_with_mfa_denied(session) -> None:
    checker = require_admin_permission("admin.sessions.view")
    with pytest.raises(PermissionDeniedError):
        await checker(claims=_claims(uuid.uuid4(), mfa=True), session=session)
