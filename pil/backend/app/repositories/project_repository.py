from __future__ import annotations

import uuid
from datetime import UTC, datetime

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.domain.models.project import Project, ProjectMember, ProjectPartnerOrg
from app.domain.models.user import User


async def get_organization_id_for_project(session: AsyncSession, project_id: uuid.UUID) -> uuid.UUID | None:
    """Minimal, RLS-independent lookup used ONLY to establish which tenant context to
    set before running the real (RLS-scoped) query — returns just the owning org id,
    never project content. Goes through the get_project_organization_id() SECURITY
    DEFINER function (migration 0003), NOT a direct SELECT on `projects` — that table
    has FORCE ROW LEVEL SECURITY, so a direct SELECT would return nothing here (no org
    context exists yet, that's the whole point of this lookup) even for app_role
    itself. See core/deps.py get_project_scoped_session for the two-step resolution
    this feeds into (Database Design doc §4)."""
    from sqlalchemy import text

    result = await session.execute(
        text("SELECT get_project_organization_id(:project_id) AS org_id").bindparams(project_id=project_id)
    )
    row = result.first()
    return row.org_id if row and row.org_id is not None else None


async def create(
    session: AsyncSession, *, organization_id: uuid.UUID, name: str, description: str | None, created_by: uuid.UUID
) -> Project:
    project = Project(organization_id=organization_id, name=name, description=description, created_by=created_by)
    session.add(project)
    await session.flush()
    return project


async def get_by_id(session: AsyncSession, project_id: uuid.UUID) -> Project | None:
    result = await session.execute(
        select(Project).where(Project.id == project_id, Project.deleted_at.is_(None))
    )
    return result.scalar_one_or_none()


async def soft_delete(session: AsyncSession, project_id: uuid.UUID) -> None:
    project = await get_by_id(session, project_id)
    if project is not None:
        project.deleted_at = datetime.now(UTC)


async def list_for_organization(session: AsyncSession, organization_id: uuid.UUID) -> list[Project]:
    result = await session.execute(
        select(Project).where(Project.organization_id == organization_id, Project.deleted_at.is_(None))
    )
    return list(result.scalars().all())


async def get_membership(
    session: AsyncSession, project_id: uuid.UUID, user_id: uuid.UUID
) -> ProjectMember | None:
    result = await session.execute(
        select(ProjectMember).where(ProjectMember.project_id == project_id, ProjectMember.user_id == user_id)
    )
    return result.scalar_one_or_none()


async def add_member(
    session: AsyncSession,
    *,
    project_id: uuid.UUID,
    organization_id: uuid.UUID,
    user_id: uuid.UUID,
    role: str,
    added_by: uuid.UUID,
) -> ProjectMember:
    member = ProjectMember(
        project_id=project_id, organization_id=organization_id, user_id=user_id, role=role, added_by=added_by
    )
    session.add(member)
    await session.flush()
    return member


async def remove_member(session: AsyncSession, *, project_id: uuid.UUID, user_id: uuid.UUID) -> None:
    member = await get_membership(session, project_id, user_id)
    if member is not None:
        await session.delete(member)


async def list_members(session: AsyncSession, project_id: uuid.UUID) -> list[ProjectMember]:
    result = await session.execute(select(ProjectMember).where(ProjectMember.project_id == project_id))
    return list(result.scalars().all())


async def list_members_with_alias(session: AsyncSession, project_id: uuid.UUID) -> list[tuple[ProjectMember, str]]:
    """Same rows as list_members, joined to the member's alias — for UI pickers
    (task assignee, @mention autocomplete) that need a human-readable label instead
    of a bare user_id. Aliases are the only identity surface this app exposes
    (Authentication Design doc §1), so this join is the normal way to resolve one."""
    result = await session.execute(
        select(ProjectMember, User.alias)
        .join(User, User.id == ProjectMember.user_id)
        .where(ProjectMember.project_id == project_id)
    )
    return [(member, alias) for member, alias in result.all()]


async def add_partner_org(
    session: AsyncSession, *, project_id: uuid.UUID, organization_id: uuid.UUID, invited_by: uuid.UUID
) -> ProjectPartnerOrg:
    grant = ProjectPartnerOrg(project_id=project_id, organization_id=organization_id, invited_by=invited_by)
    session.add(grant)
    await session.flush()
    return grant


async def is_partner_org(session: AsyncSession, project_id: uuid.UUID, organization_id: uuid.UUID) -> bool:
    result = await session.execute(
        select(ProjectPartnerOrg).where(
            ProjectPartnerOrg.project_id == project_id, ProjectPartnerOrg.organization_id == organization_id
        )
    )
    return result.scalar_one_or_none() is not None
