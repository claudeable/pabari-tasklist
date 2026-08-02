from __future__ import annotations

import uuid

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.domain.models.organization import Organization, OrganizationMember


async def create(session: AsyncSession, *, name: str, slug: str) -> Organization:
    org = Organization(name=name, slug=slug)
    session.add(org)
    await session.flush()
    return org


async def get_by_id(session: AsyncSession, organization_id: uuid.UUID) -> Organization | None:
    result = await session.execute(select(Organization).where(Organization.id == organization_id))
    return result.scalar_one_or_none()


async def get_by_slug(session: AsyncSession, slug: str) -> Organization | None:
    result = await session.execute(select(Organization).where(Organization.slug == slug))
    return result.scalar_one_or_none()


async def get_membership(
    session: AsyncSession, organization_id: uuid.UUID, user_id: uuid.UUID
) -> OrganizationMember | None:
    result = await session.execute(
        select(OrganizationMember).where(
            OrganizationMember.organization_id == organization_id, OrganizationMember.user_id == user_id
        )
    )
    return result.scalar_one_or_none()


async def add_member(
    session: AsyncSession, *, organization_id: uuid.UUID, user_id: uuid.UUID, role: str, invited_by: uuid.UUID
) -> OrganizationMember:
    member = OrganizationMember(
        organization_id=organization_id, user_id=user_id, role=role, invited_by=invited_by
    )
    session.add(member)
    await session.flush()
    return member


async def remove_member(session: AsyncSession, *, organization_id: uuid.UUID, user_id: uuid.UUID) -> None:
    member = await get_membership(session, organization_id, user_id)
    if member is not None:
        await session.delete(member)


async def set_status(session: AsyncSession, *, organization_id: uuid.UUID, status: str) -> None:
    org = await get_by_id(session, organization_id)
    if org is not None:
        org.status = status


async def list_for_user(session: AsyncSession, user_id: uuid.UUID) -> list[Organization]:
    result = await session.execute(
        select(Organization)
        .join(OrganizationMember, OrganizationMember.organization_id == Organization.id)
        .where(OrganizationMember.user_id == user_id)
    )
    return list(result.scalars().all())
