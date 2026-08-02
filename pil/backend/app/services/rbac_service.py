"""RBAC resolution (Authentication Design doc §7, Threat Model §3.2).

Phase 2 scope: org- and project-scoped role resolution against the explicit
membership tables (organization_members / project_members), checked against a
hardcoded role->permission matrix. This is deliberately NOT yet driven by the
role_permissions DB table (which exists for a future admin-configurable-permissions
UI) — the matrix below is the single source of truth for now and is easy to audit in
one place, which matters more at this stage than early configurability.

Design decision: an org_admin implicitly holds project_admin-level rights over every
project that belongs to their own organization (not over partner orgs' projects they
were merely invited into). This mirrors the product intent in the Threat Model
("Organization Administrator" manages the org, "Project Administrator" manages within
a project) without forcing every org_admin to also be explicitly added as a project
member of every project their org owns. It does NOT cross organization boundaries —
an org_admin of Org A gets no elevated rights on Org B's project even if Org A is a
partner on it; partner-org members participate as whatever project role they were
explicitly given, full stop.
"""

from __future__ import annotations

import uuid

from sqlalchemy.ext.asyncio import AsyncSession

from app.domain.enums import SystemRole
from app.repositories import organization_repository, project_repository, user_repository

# System-admin-only permission codes.
_SYSTEM_ADMIN_PERMISSIONS = {
    "admin.users.create",
    "admin.users.disable",
    "admin.users.reset_password",
    "admin.users.mfa.reset",
    "admin.organizations.create",
    "admin.organizations.suspend",
    "admin.sessions.view",
    "admin.sessions.revoke",
    "admin.devices.revoke",
    "admin.security_events.view",
    "admin.storage.view",
}

_ORG_ROLE_PERMISSIONS: dict[str, set[str]] = {
    "org_admin": {
        "org.update",
        "org.members.invite",
        "org.members.remove",
        "org.projects.create",
        "org.partners.propose",
    },
    "member": set(),
}

_PROJECT_ROLE_PERMISSIONS: dict[str, set[str]] = {
    "project_admin": {
        "project.update",
        "project.delete",
        "project.members.add",
        "project.members.remove",
        "project.members.role.update",
        "project.partner_orgs.grant",
        "channel.create",
        "message.send",
        "message.delete.any",
        "document.upload",
        "document.upload_version",
        "document.checkout",
        "document.delete",
        "document.approve",
        "document.checkout.override",
        "task.create",
        "task.update",
        "task.delete",
        "task.comment",
        "milestone.create",
        "announcement.create",
    },
    "member": {
        "channel.create",
        "message.send",
        "document.upload",
        "document.upload_version",
        "document.checkout",
        "task.create",
        "task.update",
        "task.comment",
    },
    # read_only and guest can view channels/messages (granted by project access,
    # checked separately by get_channel_scoped_session) but hold no permission codes
    # of their own — no sending, no channel creation (Threat Model §3.2, API Spec
    # "Guests: most restrictive — explicit allow-list of routes").
    "read_only": set(),
    "guest": set(),
}


async def is_system_admin(session: AsyncSession, user_id: uuid.UUID) -> bool:
    result = await user_repository.get_by_id(session, user_id)
    return result is not None and result.status == "active" and result.system_role == SystemRole.system_admin.value


async def user_has_permission(session: AsyncSession, *, user_id: str, permission_code: str) -> bool:
    """System-admin-scoped permission check (Phase 0/1 behavior, unchanged)."""
    user = await user_repository.get_by_id(session, uuid.UUID(user_id))
    if user is None or user.status != "active":
        return False

    if permission_code in _SYSTEM_ADMIN_PERMISSIONS:
        return user.system_role == SystemRole.system_admin.value

    return False


async def user_has_org_permission(
    session: AsyncSession, *, user_id: uuid.UUID, organization_id: uuid.UUID, permission_code: str
) -> bool:
    if await is_system_admin(session, user_id):
        return True

    membership = await organization_repository.get_membership(session, organization_id, user_id)
    if membership is None:
        return False

    return permission_code in _ORG_ROLE_PERMISSIONS.get(membership.role, set())


async def user_has_project_permission(
    session: AsyncSession, *, user_id: uuid.UUID, project_id: uuid.UUID, organization_id: uuid.UUID, permission_code: str
) -> bool:
    if await is_system_admin(session, user_id):
        return True

    org_membership = await organization_repository.get_membership(session, organization_id, user_id)
    if org_membership is not None and org_membership.role == "org_admin":
        return permission_code in _PROJECT_ROLE_PERMISSIONS.get("project_admin", set())

    project_membership = await project_repository.get_membership(session, project_id, user_id)
    if project_membership is None:
        return False

    return permission_code in _PROJECT_ROLE_PERMISSIONS.get(project_membership.role, set())


async def user_can_access_project(
    session: AsyncSession, *, user_id: uuid.UUID, project_id: uuid.UUID, organization_id: uuid.UUID
) -> bool:
    """Read-level access check: true membership (project or owning-org) OR access via
    an explicit cross-org partner grant for a member of the partner org (Threat Model
    §2 trust boundary 4 — never implicit)."""
    if await is_system_admin(session, user_id):
        return True

    org_membership = await organization_repository.get_membership(session, organization_id, user_id)
    if org_membership is not None:
        return True

    project_membership = await project_repository.get_membership(session, project_id, user_id)
    if project_membership is not None:
        return True

    # Cross-org path: user must belong to a partner org that was explicitly granted
    # access to this specific project.
    user = await user_repository.get_by_id(session, user_id)
    if user is None:
        return False

    from sqlalchemy import select

    from app.domain.models.organization import OrganizationMember

    result = await session.execute(select(OrganizationMember).where(OrganizationMember.user_id == user_id))
    for membership in result.scalars().all():
        if await project_repository.is_partner_org(session, project_id, membership.organization_id):
            return True

    return False
