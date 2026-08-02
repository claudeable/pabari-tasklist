"""Security Testing Plan §2 "Authorization / IDOR" — default-deny posture (least
privilege by default, Security Architecture doc §1)."""

import uuid

import pytest
from sqlalchemy.ext.asyncio import async_sessionmaker

from app.core.config import get_settings
from app.core.db import create_engine
from app.domain.enums import SystemRole
from app.domain.models.base import Base
from app.domain.models.user import User
from app.services.rbac_service import user_has_permission


@pytest.fixture
async def session():
    settings = get_settings()
    engine = create_engine(settings)
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)

    factory = async_sessionmaker(engine, expire_on_commit=False)
    async with factory() as s:
        yield s

    await engine.dispose()


async def test_regular_member_denied_system_admin_permission(session) -> None:
    user = User(alias="Falcon-01", password_hash="x", system_role=SystemRole.member.value)
    session.add(user)
    await session.commit()

    allowed = await user_has_permission(
        session, user_id=str(user.id), permission_code="admin.users.create"
    )
    assert allowed is False


async def test_system_admin_allowed_admin_permission(session) -> None:
    user = User(alias="Atlas-04", password_hash="x", system_role=SystemRole.system_admin.value)
    session.add(user)
    await session.commit()

    allowed = await user_has_permission(
        session, user_id=str(user.id), permission_code="admin.users.create"
    )
    assert allowed is True


async def test_disabled_admin_account_denied_despite_role(session) -> None:
    user = User(
        alias="Echo-11",
        password_hash="x",
        system_role=SystemRole.system_admin.value,
        status="disabled",
    )
    session.add(user)
    await session.commit()

    allowed = await user_has_permission(
        session, user_id=str(user.id), permission_code="admin.users.create"
    )
    assert allowed is False


async def test_unrecognized_permission_code_defaults_to_deny(session) -> None:
    user = User(alias="Raven-07", password_hash="x", system_role=SystemRole.system_admin.value)
    session.add(user)
    await session.commit()

    allowed = await user_has_permission(
        session, user_id=str(user.id), permission_code="project.document.approve"
    )
    # Not yet resolvable (Phase 2 RBAC) — must fail closed, never fail open.
    assert allowed is False


async def test_nonexistent_user_denied(session) -> None:
    allowed = await user_has_permission(
        session, user_id=str(uuid.uuid4()), permission_code="admin.users.create"
    )
    assert allowed is False
