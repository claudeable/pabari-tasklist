"""Organization endpoints (API Specification doc "Organizations" section)."""

from __future__ import annotations

import uuid

from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.deps import (
    get_current_claims,
    get_org_scoped_session,
    get_session,
    get_user_scoped_session,
    require_org_permission,
)
from app.core.errors import PermissionDeniedError, ResourceNotFoundError
from app.core.security.jwt import AccessTokenClaims
from app.repositories import organization_repository
from app.schemas.organization import (
    OrganizationCreateRequest,
    OrganizationMemberInviteRequest,
    OrganizationResponse,
)
from app.services import org_service
from app.services.rbac_service import user_has_permission

router = APIRouter(prefix="/organizations", tags=["organizations"])


@router.post("", response_model=OrganizationResponse, status_code=201)
async def create_organization(
    body: OrganizationCreateRequest,
    claims: AccessTokenClaims = Depends(get_current_claims),
    session: AsyncSession = Depends(get_session),
) -> OrganizationResponse:
    if not await user_has_permission(session, user_id=claims.sub, permission_code="admin.organizations.create"):
        raise PermissionDeniedError()

    org = await org_service.create_organization(
        session,
        name=body.name,
        initial_admin_user_id=uuid.UUID(body.initial_admin_user_id),
        created_by=uuid.UUID(claims.sub),
    )
    return OrganizationResponse.model_validate(org)


@router.get("", response_model=list[OrganizationResponse])
async def list_my_organizations(
    claims: AccessTokenClaims = Depends(get_current_claims), session: AsyncSession = Depends(get_user_scoped_session)
) -> list[OrganizationResponse]:
    orgs = await organization_repository.list_for_user(session, uuid.UUID(claims.sub))
    return [OrganizationResponse.model_validate(o) for o in orgs]


@router.get("/{organization_id}", response_model=OrganizationResponse)
async def get_organization(
    organization_id: uuid.UUID, session: AsyncSession = Depends(get_org_scoped_session)
) -> OrganizationResponse:
    org = await organization_repository.get_by_id(session, organization_id)
    if org is None:
        raise ResourceNotFoundError()
    return OrganizationResponse.model_validate(org)


@router.post("/{organization_id}/members", status_code=204)
async def invite_member(
    organization_id: uuid.UUID,
    body: OrganizationMemberInviteRequest,
    claims: AccessTokenClaims = Depends(require_org_permission("org.members.invite")),
    session: AsyncSession = Depends(get_org_scoped_session),
) -> None:
    await org_service.invite_member(
        session,
        organization_id=organization_id,
        user_id=uuid.UUID(body.user_id),
        role=body.role,
        invited_by=uuid.UUID(claims.sub),
    )


@router.delete("/{organization_id}/members/{user_id}", status_code=204)
async def remove_member(
    organization_id: uuid.UUID,
    user_id: uuid.UUID,
    claims: AccessTokenClaims = Depends(require_org_permission("org.members.remove")),
    session: AsyncSession = Depends(get_org_scoped_session),
) -> None:
    await org_service.remove_member(
        session, organization_id=organization_id, user_id=user_id, removed_by=uuid.UUID(claims.sub)
    )
