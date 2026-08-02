"""Channel endpoints (API Specification doc "Channels & Messages")."""

from __future__ import annotations

import uuid

from fastapi import APIRouter, Depends, Request
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import Settings, get_settings
from app.core.deps import get_current_claims, get_project_scoped_session, require_project_permission
from app.core.errors import ConflictError, ResourceNotFoundError
from app.core.security.jwt import AccessTokenClaims
from app.repositories import channel_repository, project_repository
from app.schemas.chat import ChannelCreateRequest, ChannelResponse, DmCreateRequest
from app.services import chat_service

router = APIRouter(tags=["channels"])


@router.post("/projects/{project_id}/channels", response_model=ChannelResponse, status_code=201)
async def create_channel(
    project_id: uuid.UUID,
    body: ChannelCreateRequest,
    request: Request,
    claims: AccessTokenClaims = Depends(require_project_permission("channel.create")),
    session: AsyncSession = Depends(get_project_scoped_session),
    settings: Settings = Depends(get_settings),
) -> ChannelResponse:
    # organization_id was already resolved and stashed on request.state by
    # get_project_scoped_session — no need to re-derive it with another query.
    channel = await chat_service.create_channel(
        session,
        settings,
        project_id=project_id,
        organization_id=request.state.resolved_organization_id,
        name=body.name,
        is_private=body.is_private,
    )
    # Membership is tracked for every channel (not just private ones) so a channel
    # can later be made private without silently losing its creator's access.
    organization_id = request.state.resolved_organization_id
    await channel_repository.add_member(
        session, channel_id=channel.id, organization_id=organization_id, user_id=uuid.UUID(claims.sub)
    )

    if body.is_private and body.member_ids:
        project_members = await project_repository.list_members(session, project_id)
        valid_ids = {m.user_id for m in project_members}
        for raw_id in body.member_ids:
            try:
                member_id = uuid.UUID(raw_id)
            except ValueError:
                continue
            if member_id not in valid_ids:
                continue
            await channel_repository.add_member(
                session, channel_id=channel.id, organization_id=organization_id, user_id=member_id
            )

    return ChannelResponse.model_validate(channel)


@router.get("/projects/{project_id}/channels", response_model=list[ChannelResponse])
async def list_channels(
    project_id: uuid.UUID,
    claims: AccessTokenClaims = Depends(get_current_claims),
    session: AsyncSession = Depends(get_project_scoped_session),
) -> list[ChannelResponse]:
    channels = await channel_repository.list_visible_for_user(session, project_id, uuid.UUID(claims.sub))
    return [ChannelResponse.model_validate(c) for c in channels]


@router.post("/projects/{project_id}/channels/dm", response_model=ChannelResponse, status_code=201)
async def create_or_get_dm(
    project_id: uuid.UUID,
    body: DmCreateRequest,
    request: Request,
    claims: AccessTokenClaims = Depends(get_current_claims),
    session: AsyncSession = Depends(get_project_scoped_session),
    settings: Settings = Depends(get_settings),
) -> ChannelResponse:
    me = uuid.UUID(claims.sub)
    other = uuid.UUID(body.other_user_id)
    if other == me:
        raise ConflictError("Cannot start a DM with yourself")

    members = await project_repository.list_members(session, project_id)
    if not any(m.user_id == other for m in members):
        raise ResourceNotFoundError("That user is not a member of this project")

    existing = await channel_repository.find_dm_channel(session, project_id=project_id, user_a=me, user_b=other)
    if existing is not None:
        return ChannelResponse.model_validate(existing)

    organization_id = request.state.resolved_organization_id
    channel = await chat_service.create_channel(
        session,
        settings,
        project_id=project_id,
        organization_id=organization_id,
        name=f"dm-{me}-{other}",
        is_private=True,
    )
    await channel_repository.add_member(session, channel_id=channel.id, organization_id=organization_id, user_id=me)
    await channel_repository.add_member(session, channel_id=channel.id, organization_id=organization_id, user_id=other)
    return ChannelResponse.model_validate(channel)
