"""Project endpoints (API Specification doc "Projects" section)."""

from __future__ import annotations

import uuid

from fastapi import APIRouter, Depends, Request
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.deps import (
    get_org_scoped_session,
    get_project_scoped_session,
    require_org_permission,
    require_project_permission,
)
from app.core.errors import ResourceNotFoundError
from app.core.presence import get_online_user_ids
from app.core.security.jwt import AccessTokenClaims
from app.repositories import project_repository
from app.schemas.project import (
    ProjectCreateRequest,
    ProjectMemberAddRequest,
    ProjectMemberResponse,
    ProjectMemberRoleUpdateRequest,
    ProjectResponse,
    ProjectUpdateRequest,
)
from app.services import project_service

router = APIRouter(tags=["projects"])


@router.post("/organizations/{organization_id}/projects", response_model=ProjectResponse, status_code=201)
async def create_project(
    organization_id: uuid.UUID,
    body: ProjectCreateRequest,
    claims: AccessTokenClaims = Depends(require_org_permission("org.projects.create")),
    session: AsyncSession = Depends(get_org_scoped_session),
) -> ProjectResponse:
    project = await project_service.create_project(
        session,
        organization_id=organization_id,
        name=body.name,
        description=body.description,
        created_by=uuid.UUID(claims.sub),
    )
    return ProjectResponse.model_validate(project)


@router.get("/organizations/{organization_id}/projects", response_model=list[ProjectResponse])
async def list_projects(
    organization_id: uuid.UUID, session: AsyncSession = Depends(get_org_scoped_session)
) -> list[ProjectResponse]:
    projects = await project_repository.list_for_organization(session, organization_id)
    return [ProjectResponse.model_validate(p) for p in projects]


@router.get("/projects/{project_id}", response_model=ProjectResponse)
async def get_project(
    project_id: uuid.UUID, session: AsyncSession = Depends(get_project_scoped_session)
) -> ProjectResponse:
    project = await project_repository.get_by_id(session, project_id)
    if project is None:
        raise ResourceNotFoundError()
    return ProjectResponse.model_validate(project)


@router.patch("/projects/{project_id}", response_model=ProjectResponse)
async def update_project(
    project_id: uuid.UUID,
    body: ProjectUpdateRequest,
    claims: AccessTokenClaims = Depends(require_project_permission("project.update")),
    session: AsyncSession = Depends(get_project_scoped_session),
) -> ProjectResponse:
    project = await project_service.update_project(
        session, project_id=project_id, name=body.name, description=body.description
    )
    return ProjectResponse.model_validate(project)


@router.delete("/projects/{project_id}", status_code=204)
async def delete_project(
    project_id: uuid.UUID,
    claims: AccessTokenClaims = Depends(require_project_permission("project.delete")),
    session: AsyncSession = Depends(get_project_scoped_session),
) -> None:
    await project_service.delete_project(session, project_id=project_id, deleted_by=uuid.UUID(claims.sub))


@router.get("/projects/{project_id}/members", response_model=list[ProjectMemberResponse])
async def list_members(
    project_id: uuid.UUID, session: AsyncSession = Depends(get_project_scoped_session)
) -> list[ProjectMemberResponse]:
    members = await project_repository.list_members_with_alias(session, project_id)
    return [
        ProjectMemberResponse(user_id=m.user_id, alias=alias, role=m.role, added_at=m.added_at)
        for m, alias in members
    ]


@router.get("/projects/{project_id}/presence", response_model=dict[str, bool])
async def get_presence(
    project_id: uuid.UUID, request: Request, session: AsyncSession = Depends(get_project_scoped_session)
) -> dict[str, bool]:
    members = await project_repository.list_members(session, project_id)
    online_ids = await get_online_user_ids(request.app.state.redis, [m.user_id for m in members])
    return {str(m.user_id): m.user_id in online_ids for m in members}


@router.post("/projects/{project_id}/members", status_code=204)
async def add_member(
    project_id: uuid.UUID,
    body: ProjectMemberAddRequest,
    claims: AccessTokenClaims = Depends(require_project_permission("project.members.add")),
    session: AsyncSession = Depends(get_project_scoped_session),
) -> None:
    project = await project_repository.get_by_id(session, project_id)
    if project is None:
        raise ResourceNotFoundError()
    await project_service.add_member(
        session,
        project_id=project_id,
        organization_id=project.organization_id,
        user_id=uuid.UUID(body.user_id),
        role=body.role,
        added_by=uuid.UUID(claims.sub),
    )


@router.patch("/projects/{project_id}/members/{user_id}", status_code=204)
async def update_member_role(
    project_id: uuid.UUID,
    user_id: uuid.UUID,
    body: ProjectMemberRoleUpdateRequest,
    claims: AccessTokenClaims = Depends(require_project_permission("project.members.role.update")),
    session: AsyncSession = Depends(get_project_scoped_session),
) -> None:
    await project_service.update_member_role(
        session, project_id=project_id, user_id=user_id, role=body.role, updated_by=uuid.UUID(claims.sub)
    )


@router.delete("/projects/{project_id}/members/{user_id}", status_code=204)
async def remove_member(
    project_id: uuid.UUID,
    user_id: uuid.UUID,
    claims: AccessTokenClaims = Depends(require_project_permission("project.members.remove")),
    session: AsyncSession = Depends(get_project_scoped_session),
) -> None:
    await project_service.remove_member(
        session, project_id=project_id, user_id=user_id, removed_by=uuid.UUID(claims.sub)
    )


@router.post("/projects/{project_id}/partner-orgs/{organization_id}", status_code=204)
async def grant_partner_org(
    project_id: uuid.UUID,
    organization_id: uuid.UUID,
    claims: AccessTokenClaims = Depends(require_project_permission("project.partner_orgs.grant")),
    session: AsyncSession = Depends(get_project_scoped_session),
) -> None:
    await project_service.grant_partner_org(
        session, project_id=project_id, organization_id=organization_id, invited_by=uuid.UUID(claims.sub)
    )
