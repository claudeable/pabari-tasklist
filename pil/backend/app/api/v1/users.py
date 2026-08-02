"""Self-service user endpoints (API Specification doc "Users (self)" section)."""

from __future__ import annotations

import uuid

from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.deps import get_current_claims, get_session
from app.core.errors import NotAuthenticatedError
from app.core.security.jwt import AccessTokenClaims
from app.repositories import user_repository
from app.schemas.user import DeviceResponse, MeResponse, SessionResponse
from app.services import device_service

router = APIRouter(prefix="/users/me", tags=["users"])


@router.get("", response_model=MeResponse)
async def get_me(
    claims: AccessTokenClaims = Depends(get_current_claims), session: AsyncSession = Depends(get_session)
) -> MeResponse:
    user = await user_repository.get_by_id(session, uuid.UUID(claims.sub))
    if user is None:
        raise NotAuthenticatedError()
    return MeResponse(id=str(user.id), alias=user.alias, system_role=user.system_role, mfa_enabled=user.mfa_enabled)


@router.get("/devices", response_model=list[DeviceResponse])
async def list_devices(
    claims: AccessTokenClaims = Depends(get_current_claims), session: AsyncSession = Depends(get_session)
) -> list[DeviceResponse]:
    devices = await device_service.list_devices(session, user_id=uuid.UUID(claims.sub))
    return [DeviceResponse.model_validate(d) for d in devices]


@router.delete("/devices/{device_id}", status_code=204)
async def revoke_device(
    device_id: uuid.UUID,
    claims: AccessTokenClaims = Depends(get_current_claims),
    session: AsyncSession = Depends(get_session),
) -> None:
    await device_service.revoke_device(session, user_id=uuid.UUID(claims.sub), device_id=device_id)


@router.get("/sessions", response_model=list[SessionResponse])
async def list_sessions(
    claims: AccessTokenClaims = Depends(get_current_claims), session: AsyncSession = Depends(get_session)
) -> list[SessionResponse]:
    sessions = await device_service.list_active_sessions(session, user_id=uuid.UUID(claims.sub))
    return [
        SessionResponse(
            id=str(s.id), device_id=str(s.device_id), ip_address=s.ip_address, issued_at=s.issued_at, expires_at=s.expires_at
        )
        for s in sessions
    ]


@router.delete("/sessions/{session_id}", status_code=204)
async def revoke_session(
    session_id: uuid.UUID,
    claims: AccessTokenClaims = Depends(get_current_claims),
    session: AsyncSession = Depends(get_session),
) -> None:
    await device_service.revoke_session(session, user_id=uuid.UUID(claims.sub), session_id=session_id)
