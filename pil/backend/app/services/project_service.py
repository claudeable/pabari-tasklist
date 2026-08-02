"""Project creation and membership management (API Specification "Projects" /
"Channels & Messages" sections build on top of this in Phase 3)."""

from __future__ import annotations

import uuid

from sqlalchemy.ext.asyncio import AsyncSession

from app.core.errors import ConflictError, ResourceNotFoundError
from app.domain.enums import SecurityEventType
from app.domain.models.project import Project
from app.repositories import organization_repository, project_repository, user_repository
from app.services.security_event_service import record_security_event


async def create_project(
    session: AsyncSession, *, organization_id: uuid.UUID, name: str, description: str | None, created_by: uuid.UUID
) -> Project:
    project = await project_repository.create(
        session, organization_id=organization_id, name=name, description=description, created_by=created_by
    )
    # The creator is automatically a project_admin of what they just created — least
    # surprise, and avoids a project existing with zero members able to manage it.
    await project_repository.add_member(
        session,
        project_id=project.id,
        organization_id=organization_id,
        user_id=created_by,
        role="project_admin",
        added_by=created_by,
    )
    await record_security_event(
        session,
        event_type=SecurityEventType.admin_action.value,
        user_id=created_by,
        organization_id=organization_id,
        metadata={"action": "project_created", "project_id": str(project.id)},
    )
    return project


async def update_project(
    session: AsyncSession, *, project_id: uuid.UUID, name: str | None, description: str | None
) -> Project:
    project = await project_repository.get_by_id(session, project_id)
    if project is None:
        raise ResourceNotFoundError()
    if name is not None:
        project.name = name
    if description is not None:
        project.description = description
    return project


async def delete_project(session: AsyncSession, *, project_id: uuid.UUID, deleted_by: uuid.UUID) -> None:
    await project_repository.soft_delete(session, project_id)
    await record_security_event(
        session,
        event_type=SecurityEventType.admin_action.value,
        user_id=deleted_by,
        metadata={"action": "project_deleted", "project_id": str(project_id)},
    )


async def add_member(
    session: AsyncSession,
    *,
    project_id: uuid.UUID,
    organization_id: uuid.UUID,
    user_id: uuid.UUID,
    role: str,
    added_by: uuid.UUID,
) -> None:
    if await user_repository.get_by_id(session, user_id) is None:
        raise ResourceNotFoundError("User not found")

    existing = await project_repository.get_membership(session, project_id, user_id)
    if existing is not None:
        raise ConflictError("User is already a member of this project")

    await project_repository.add_member(
        session, project_id=project_id, organization_id=organization_id, user_id=user_id, role=role, added_by=added_by
    )
    await record_security_event(
        session,
        event_type=SecurityEventType.admin_action.value,
        user_id=added_by,
        organization_id=organization_id,
        metadata={"action": "project_member_added", "project_id": str(project_id), "target_user_id": str(user_id), "role": role},
    )


async def remove_member(
    session: AsyncSession, *, project_id: uuid.UUID, user_id: uuid.UUID, removed_by: uuid.UUID
) -> None:
    await project_repository.remove_member(session, project_id=project_id, user_id=user_id)
    await record_security_event(
        session,
        event_type=SecurityEventType.admin_action.value,
        user_id=removed_by,
        metadata={"action": "project_member_removed", "project_id": str(project_id), "target_user_id": str(user_id)},
    )


async def update_member_role(
    session: AsyncSession, *, project_id: uuid.UUID, user_id: uuid.UUID, role: str, updated_by: uuid.UUID
) -> None:
    membership = await project_repository.get_membership(session, project_id, user_id)
    if membership is None:
        raise ResourceNotFoundError()
    membership.role = role
    await record_security_event(
        session,
        event_type=SecurityEventType.admin_action.value,
        user_id=updated_by,
        metadata={
            "action": "project_member_role_updated",
            "project_id": str(project_id),
            "target_user_id": str(user_id),
            "role": role,
        },
    )


async def grant_partner_org(
    session: AsyncSession, *, project_id: uuid.UUID, organization_id: uuid.UUID, invited_by: uuid.UUID
) -> None:
    if await organization_repository.get_by_id(session, organization_id) is None:
        raise ResourceNotFoundError("Organization not found")

    if await project_repository.is_partner_org(session, project_id, organization_id):
        raise ConflictError("Organization already has partner access to this project")

    await project_repository.add_partner_org(
        session, project_id=project_id, organization_id=organization_id, invited_by=invited_by
    )
    await record_security_event(
        session,
        event_type=SecurityEventType.admin_action.value,
        user_id=invited_by,
        metadata={
            "action": "project_partner_org_granted",
            "project_id": str(project_id),
            "partner_organization_id": str(organization_id),
        },
    )
