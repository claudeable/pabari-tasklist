"""Shared FastAPI dependencies: DB session (tenant-scoped), current user, RBAC guards.

Tenant scoping is resolved from the REQUEST'S TARGET RESOURCE (path params), never from
a claim baked into the access token — a single user can belong to multiple
organizations, so "which org" is a per-request fact determined by which resource is
being addressed, not a session-wide property (Database Design doc §4, Threat Model
§3.2). Every org/project-scoped route should depend on `get_org_scoped_session` or
`get_project_scoped_session`, not the raw `get_tenant_session`.
"""

from __future__ import annotations

import uuid
from collections.abc import AsyncIterator

from fastapi import Depends, Request
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import Settings, get_settings
from app.core.errors import NotAuthenticatedError, PermissionDeniedError, ResourceNotFoundError
from app.core.security.jwt import AccessTokenClaims, TokenError, verify_access_token


def get_current_claims(request: Request, settings: Settings = Depends(get_settings)) -> AccessTokenClaims:
    auth_header = request.headers.get("Authorization", "")
    if not auth_header.startswith("Bearer "):
        raise NotAuthenticatedError("Missing bearer token")
    token = auth_header.removeprefix("Bearer ").strip()

    public_key = settings.resolve_secret(settings.jwt_public_key, settings.jwt_public_key_path, "jwt_public_key")
    try:
        return verify_access_token(token, public_key_pem=public_key, issuer=settings.jwt_issuer)
    except TokenError as exc:
        raise NotAuthenticatedError("Invalid or expired token") from exc


def require_mfa(claims: AccessTokenClaims = Depends(get_current_claims)) -> AccessTokenClaims:
    """Step-up check for admin-scoped routes (Authentication Design doc §5)."""
    if not claims.mfa:
        raise PermissionDeniedError("This action requires MFA-verified authentication")
    return claims


def get_storage(request: Request):
    return request.app.state.storage


def get_scanner(request: Request):
    return request.app.state.scanner


async def get_session(request: Request) -> AsyncIterator[AsyncSession]:
    """Untenanted session — for pre-authentication flows (login, refresh) and for
    system_admin-scoped admin routes that legitimately operate across all tenants.
    Never used for a route that resolves a specific org/project's data."""
    session_factory = request.app.state.session_factory
    async with session_factory() as session:
        async with session.begin():
            yield session


async def get_user_scoped_session(
    request: Request, claims: AccessTokenClaims = Depends(get_current_claims)
) -> AsyncIterator[AsyncSession]:
    """For routes scoped to 'things belonging to me' with no single org context —
    notifications span every org a user belongs to. Sets app.current_user_id (for the
    notifications RLS policy) but no app.current_org_id."""
    from app.core.db import tenant_scoped_session

    session_factory = request.app.state.session_factory
    async with tenant_scoped_session(session_factory, user_id=claims.sub, organization_id=None) as session:
        yield session


async def get_org_scoped_session(
    request: Request,
    organization_id: uuid.UUID,
    claims: AccessTokenClaims = Depends(get_current_claims),
) -> AsyncIterator[AsyncSession]:
    """For routes shaped /organizations/{organization_id}/... — sets RLS context to
    the org named in the path and verifies the caller is either a member or a
    system_admin before yielding. Membership-vs-permission (what they're ALLOWED to do
    once inside) is checked separately by `require_org_permission`."""
    from app.core.db import tenant_scoped_session
    from app.repositories import organization_repository
    from app.services.rbac_service import is_system_admin

    session_factory = request.app.state.session_factory
    async with tenant_scoped_session(
        session_factory, user_id=claims.sub, organization_id=str(organization_id)
    ) as session:
        user_id = uuid.UUID(claims.sub)
        is_admin = await is_system_admin(session, user_id)
        if not is_admin:
            membership = await organization_repository.get_membership(session, organization_id, user_id)
            if membership is None:
                raise PermissionDeniedError()
        yield session


async def get_project_scoped_session(
    request: Request,
    project_id: uuid.UUID,
    claims: AccessTokenClaims = Depends(get_current_claims),
) -> AsyncIterator[AsyncSession]:
    """For routes shaped /projects/{project_id}/... — resolves the owning org first
    (Database Design doc §4: a minimal, RLS-independent lookup of organization_id only,
    never project content), sets RLS context to that org, then verifies the caller can
    access the project (own-org member, explicit project member, or partner-org member
    — Threat Model §2 trust boundary 4) before yielding."""
    from app.core.db import tenant_scoped_session
    from app.repositories import project_repository
    from app.services.rbac_service import user_can_access_project

    session_factory = request.app.state.session_factory

    # Bootstrap lookup, outside any tenant context, to learn which org owns this
    # project id — deliberately returns nothing but the org id.
    async with session_factory() as bootstrap_session:
        organization_id = await project_repository.get_organization_id_for_project(bootstrap_session, project_id)

    if organization_id is None:
        raise ResourceNotFoundError()

    async with tenant_scoped_session(
        session_factory, user_id=claims.sub, organization_id=str(organization_id)
    ) as session:
        user_id = uuid.UUID(claims.sub)
        if not await user_can_access_project(
            session, user_id=user_id, project_id=project_id, organization_id=organization_id
        ):
            raise PermissionDeniedError()
        request.state.resolved_organization_id = organization_id
        yield session


async def get_channel_scoped_session(
    request: Request,
    channel_id: uuid.UUID,
    claims: AccessTokenClaims = Depends(get_current_claims),
) -> AsyncIterator[AsyncSession]:
    """For routes shaped /channels/{channel_id}/... — resolves the owning org via the
    same SECURITY-DEFINER-backed pattern as get_project_scoped_session, then verifies
    the caller can access the channel's project before yielding."""
    from app.core.db import tenant_scoped_session
    from app.repositories import channel_repository
    from app.services.rbac_service import user_can_access_project

    session_factory = request.app.state.session_factory

    async with session_factory() as bootstrap_session:
        organization_id = await channel_repository.get_organization_id_for_channel(bootstrap_session, channel_id)

    if organization_id is None:
        raise ResourceNotFoundError()

    async with tenant_scoped_session(
        session_factory, user_id=claims.sub, organization_id=str(organization_id)
    ) as session:
        user_id = uuid.UUID(claims.sub)
        channel = await channel_repository.get_by_id(session, channel_id)
        if channel is None:
            raise ResourceNotFoundError()
        if not await user_can_access_project(
            session, user_id=user_id, project_id=channel.project_id, organization_id=organization_id
        ):
            raise PermissionDeniedError()
        # Project access alone is org-wide and not enough for a private channel (a
        # DM or private group) — those need explicit per-channel membership, or any
        # org member could read a conversation meant for two specific people.
        if channel.is_private and not await channel_repository.is_member(session, channel_id, user_id):
            raise PermissionDeniedError()
        request.state.resolved_organization_id = organization_id
        request.state.resolved_project_id = channel.project_id
        yield session


async def get_message_scoped_session(
    request: Request,
    message_id: uuid.UUID,
    claims: AccessTokenClaims = Depends(get_current_claims),
) -> AsyncIterator[AsyncSession]:
    """For routes shaped /messages/{message_id}/... (edit/delete/read) — same
    SECURITY-DEFINER-backed resolution pattern as channels/projects, one hop further:
    resolve the owning org from the message, then verify project-level channel access."""
    from app.core.db import tenant_scoped_session
    from app.repositories import channel_repository, message_repository

    session_factory = request.app.state.session_factory

    async with session_factory() as bootstrap_session:
        organization_id = await message_repository.get_organization_id_for_message(bootstrap_session, message_id)

    if organization_id is None:
        raise ResourceNotFoundError()

    async with tenant_scoped_session(
        session_factory, user_id=claims.sub, organization_id=str(organization_id)
    ) as session:
        from app.services.rbac_service import user_can_access_project

        message = await message_repository.get_by_id(session, message_id)
        if message is None:
            raise ResourceNotFoundError()
        channel = await channel_repository.get_by_id(session, message.channel_id)
        if channel is None:
            raise ResourceNotFoundError()
        user_id = uuid.UUID(claims.sub)
        if not await user_can_access_project(
            session, user_id=user_id, project_id=channel.project_id, organization_id=organization_id
        ):
            raise PermissionDeniedError()
        request.state.resolved_organization_id = organization_id
        request.state.resolved_project_id = channel.project_id
        request.state.resolved_channel_id = channel.id
        yield session


async def get_attachment_scoped_session(
    request: Request,
    attachment_id: uuid.UUID,
    claims: AccessTokenClaims = Depends(get_current_claims),
) -> AsyncIterator[AsyncSession]:
    """For routes shaped /attachments/{attachment_id}/... — same SECURITY-DEFINER
    resolution pattern as get_message_scoped_session, plus the private-channel
    membership check get_channel_scoped_session applies (an attachment shared in a
    DM must be as private as the DM itself, not just as private as its channel's
    project)."""
    from app.core.db import tenant_scoped_session
    from app.repositories import attachment_repository, channel_repository

    session_factory = request.app.state.session_factory

    async with session_factory() as bootstrap_session:
        organization_id = await attachment_repository.get_organization_id_for_attachment(
            bootstrap_session, attachment_id
        )

    if organization_id is None:
        raise ResourceNotFoundError()

    async with tenant_scoped_session(
        session_factory, user_id=claims.sub, organization_id=str(organization_id)
    ) as session:
        from app.services.rbac_service import user_can_access_project

        attachment = await attachment_repository.get_by_id(session, attachment_id)
        if attachment is None:
            raise ResourceNotFoundError()
        channel = await channel_repository.get_by_id(session, attachment.channel_id)
        if channel is None:
            raise ResourceNotFoundError()
        user_id = uuid.UUID(claims.sub)
        if not await user_can_access_project(
            session, user_id=user_id, project_id=channel.project_id, organization_id=organization_id
        ):
            raise PermissionDeniedError()
        if channel.is_private and not await channel_repository.is_member(session, channel.id, user_id):
            raise PermissionDeniedError()
        request.state.resolved_organization_id = organization_id
        request.state.resolved_project_id = channel.project_id
        request.state.resolved_channel_id = channel.id
        yield session


async def get_document_scoped_session(
    request: Request,
    document_id: uuid.UUID,
    claims: AccessTokenClaims = Depends(get_current_claims),
) -> AsyncIterator[AsyncSession]:
    """For routes shaped /documents/{document_id}/... — same SECURITY-DEFINER-backed
    resolution pattern as channels/projects/messages."""
    from app.core.db import tenant_scoped_session
    from app.repositories import document_repository

    session_factory = request.app.state.session_factory

    async with session_factory() as bootstrap_session:
        organization_id = await document_repository.get_organization_id_for_document(bootstrap_session, document_id)

    if organization_id is None:
        raise ResourceNotFoundError()

    async with tenant_scoped_session(
        session_factory, user_id=claims.sub, organization_id=str(organization_id)
    ) as session:
        from app.services.rbac_service import user_can_access_project

        document = await document_repository.get_by_id(session, document_id)
        if document is None:
            raise ResourceNotFoundError()
        user_id = uuid.UUID(claims.sub)
        if not await user_can_access_project(
            session, user_id=user_id, project_id=document.project_id, organization_id=organization_id
        ):
            raise PermissionDeniedError()
        request.state.resolved_organization_id = organization_id
        request.state.resolved_project_id = document.project_id
        yield session


def require_document_permission(permission_code: str):
    """Route dependency: caller must hold `permission_code` for the PROJECT that owns
    the document named in the path — documents inherit the caller's project role."""

    async def _checker(
        document_id: uuid.UUID,
        request: Request,
        claims: AccessTokenClaims = Depends(get_current_claims),
        session: AsyncSession = Depends(get_document_scoped_session),
    ) -> AccessTokenClaims:
        from app.services.rbac_service import user_has_project_permission

        organization_id = request.state.resolved_organization_id
        project_id = request.state.resolved_project_id
        allowed = await user_has_project_permission(
            session,
            user_id=uuid.UUID(claims.sub),
            project_id=project_id,
            organization_id=organization_id,
            permission_code=permission_code,
        )
        if not allowed:
            raise PermissionDeniedError()
        return claims

    return _checker


async def get_task_scoped_session(
    request: Request,
    task_id: uuid.UUID,
    claims: AccessTokenClaims = Depends(get_current_claims),
) -> AsyncIterator[AsyncSession]:
    """For routes shaped /tasks/{task_id}/... — same SECURITY-DEFINER-backed
    resolution pattern as documents/channels/projects."""
    from app.core.db import tenant_scoped_session
    from app.repositories import task_repository

    session_factory = request.app.state.session_factory

    async with session_factory() as bootstrap_session:
        organization_id = await task_repository.get_organization_id_for_task(bootstrap_session, task_id)

    if organization_id is None:
        raise ResourceNotFoundError()

    async with tenant_scoped_session(
        session_factory, user_id=claims.sub, organization_id=str(organization_id)
    ) as session:
        from app.services.rbac_service import user_can_access_project

        task = await task_repository.get_by_id(session, task_id)
        if task is None:
            raise ResourceNotFoundError()
        user_id = uuid.UUID(claims.sub)
        if not await user_can_access_project(
            session, user_id=user_id, project_id=task.project_id, organization_id=organization_id
        ):
            raise PermissionDeniedError()
        request.state.resolved_organization_id = organization_id
        request.state.resolved_project_id = task.project_id
        yield session


def require_task_permission(permission_code: str):
    """Route dependency: caller must hold `permission_code` for the PROJECT that owns
    the task named in the path — tasks inherit the caller's project role."""

    async def _checker(
        task_id: uuid.UUID,
        request: Request,
        claims: AccessTokenClaims = Depends(get_current_claims),
        session: AsyncSession = Depends(get_task_scoped_session),
    ) -> AccessTokenClaims:
        from app.services.rbac_service import user_has_project_permission

        organization_id = request.state.resolved_organization_id
        project_id = request.state.resolved_project_id
        allowed = await user_has_project_permission(
            session,
            user_id=uuid.UUID(claims.sub),
            project_id=project_id,
            organization_id=organization_id,
            permission_code=permission_code,
        )
        if not allowed:
            raise PermissionDeniedError()
        return claims

    return _checker


def require_permission(permission_code: str):
    """System-admin-scoped permission check (admin.* codes)."""

    async def _checker(
        claims: AccessTokenClaims = Depends(get_current_claims),
        session: AsyncSession = Depends(get_session),
    ) -> AccessTokenClaims:
        from app.services.rbac_service import user_has_permission

        if not await user_has_permission(session, user_id=claims.sub, permission_code=permission_code):
            raise PermissionDeniedError()
        return claims

    return _checker


def require_admin_permission(permission_code: str):
    """Admin panel routes require BOTH the admin.* permission AND MFA step-up
    (Authentication Design doc §5) — the admin surface is the highest-privilege one in
    the system (Development Roadmap Phase 6 gate note: "admin surface is highest
    privilege"), so a stolen-but-not-MFA-verified access token is not enough on its
    own, even for a system_admin account."""

    async def _checker(
        claims: AccessTokenClaims = Depends(get_current_claims),
        session: AsyncSession = Depends(get_session),
        settings: Settings = Depends(get_settings),
    ) -> AccessTokenClaims:
        from app.services.rbac_service import user_has_permission

        # When this deployment has MFA turned off entirely (MFA_ENFORCED=false),
        # no token will ever carry mfa=True — enforcing the step-up check anyway
        # would just lock everyone, including system_admin, out of the admin
        # surface permanently. Gate this the same way login itself is gated.
        if settings.mfa_enforced and not claims.mfa:
            raise PermissionDeniedError("This action requires MFA-verified authentication")
        if not await user_has_permission(session, user_id=claims.sub, permission_code=permission_code):
            raise PermissionDeniedError()
        return claims

    return _checker


def require_org_permission(permission_code: str):
    """Route dependency: caller must hold `permission_code` for the org named in the
    path (see get_org_scoped_session — membership is already verified by that point;
    this additionally checks the specific action is allowed for their role)."""

    async def _checker(
        organization_id: uuid.UUID,
        claims: AccessTokenClaims = Depends(get_current_claims),
        session: AsyncSession = Depends(get_org_scoped_session),
    ) -> AccessTokenClaims:
        from app.services.rbac_service import user_has_org_permission

        allowed = await user_has_org_permission(
            session, user_id=uuid.UUID(claims.sub), organization_id=organization_id, permission_code=permission_code
        )
        if not allowed:
            raise PermissionDeniedError()
        return claims

    return _checker


def require_channel_permission(permission_code: str):
    """Route dependency: caller must hold `permission_code` for the PROJECT that owns
    the channel named in the path — channels don't have their own role granularity,
    they inherit the caller's project role (get_channel_scoped_session already
    verified project-level access; this additionally checks the specific action)."""

    async def _checker(
        channel_id: uuid.UUID,
        request: Request,
        claims: AccessTokenClaims = Depends(get_current_claims),
        session: AsyncSession = Depends(get_channel_scoped_session),
    ) -> AccessTokenClaims:
        from app.services.rbac_service import user_has_project_permission

        organization_id = request.state.resolved_organization_id
        project_id = request.state.resolved_project_id
        allowed = await user_has_project_permission(
            session,
            user_id=uuid.UUID(claims.sub),
            project_id=project_id,
            organization_id=organization_id,
            permission_code=permission_code,
        )
        if not allowed:
            raise PermissionDeniedError()
        return claims

    return _checker


def require_project_permission(permission_code: str):
    """Route dependency: caller must hold `permission_code` for the project named in
    the path (see get_project_scoped_session — read-level access is already verified;
    this additionally checks the specific mutating action is allowed for their role)."""

    async def _checker(
        project_id: uuid.UUID,
        request: Request,
        claims: AccessTokenClaims = Depends(get_current_claims),
        session: AsyncSession = Depends(get_project_scoped_session),
    ) -> AccessTokenClaims:
        from app.services.rbac_service import user_has_project_permission

        organization_id = request.state.resolved_organization_id
        allowed = await user_has_project_permission(
            session,
            user_id=uuid.UUID(claims.sub),
            project_id=project_id,
            organization_id=organization_id,
            permission_code=permission_code,
        )
        if not allowed:
            raise PermissionDeniedError()
        return claims

    return _checker
