"""Organization creation and membership management (API Specification "Organizations",
Threat Model §2 trust boundary: "Organizations cannot access each other's projects
unless explicitly invited")."""

from __future__ import annotations

import re
import uuid

from sqlalchemy.ext.asyncio import AsyncSession

from app.core.db import _set_local
from app.core.errors import ConflictError, ResourceNotFoundError
from app.domain.enums import SecurityEventType
from app.domain.models.organization import Organization
from app.repositories import organization_repository, user_repository
from app.services.security_event_service import record_security_event

_SLUG_SANITIZE = re.compile(r"[^a-z0-9-]+")


def _slugify(name: str) -> str:
    slug = _SLUG_SANITIZE.sub("-", name.lower()).strip("-")
    return slug or "org"


async def create_organization(
    session: AsyncSession, *, name: str, initial_admin_user_id: uuid.UUID, created_by: uuid.UUID
) -> Organization:
    admin_user = await user_repository.get_by_id(session, initial_admin_user_id)
    if admin_user is None:
        raise ResourceNotFoundError("Initial admin user not found")

    base_slug = _slugify(name)
    slug = base_slug
    suffix = 1
    while await organization_repository.get_by_slug(session, slug) is not None:
        suffix += 1
        slug = f"{base_slug}-{suffix}"

    org = await organization_repository.create(session, name=name, slug=slug)
    # organization_members' RLS INSERT check requires app.current_org_id to already
    # equal the row being inserted — the endpoint's session has no org context yet
    # (there was no org to scope to before this call), so this session never had it
    # set. Bootstrap it here now that the org exists, scoped to this transaction only.
    await session.execute(_set_local("app.current_org_id", str(org.id)))
    await organization_repository.add_member(
        session, organization_id=org.id, user_id=initial_admin_user_id, role="org_admin", invited_by=created_by
    )
    await record_security_event(
        session,
        event_type=SecurityEventType.admin_action.value,
        user_id=created_by,
        organization_id=org.id,
        metadata={"action": "organization_created", "organization_id": str(org.id)},
    )
    return org


async def invite_member(
    session: AsyncSession, *, organization_id: uuid.UUID, user_id: uuid.UUID, role: str, invited_by: uuid.UUID
) -> None:
    if await user_repository.get_by_id(session, user_id) is None:
        raise ResourceNotFoundError("User not found")

    existing = await organization_repository.get_membership(session, organization_id, user_id)
    if existing is not None:
        raise ConflictError("User is already a member of this organization")

    await organization_repository.add_member(
        session, organization_id=organization_id, user_id=user_id, role=role, invited_by=invited_by
    )
    await record_security_event(
        session,
        event_type=SecurityEventType.admin_action.value,
        user_id=invited_by,
        organization_id=organization_id,
        metadata={"action": "member_invited", "target_user_id": str(user_id), "role": role},
    )


async def remove_member(
    session: AsyncSession, *, organization_id: uuid.UUID, user_id: uuid.UUID, removed_by: uuid.UUID
) -> None:
    await organization_repository.remove_member(session, organization_id=organization_id, user_id=user_id)
    await record_security_event(
        session,
        event_type=SecurityEventType.admin_action.value,
        user_id=removed_by,
        organization_id=organization_id,
        metadata={"action": "member_removed", "target_user_id": str(user_id)},
    )
