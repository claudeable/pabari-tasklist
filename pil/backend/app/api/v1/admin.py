"""Admin panel endpoints (API Specification doc "Admin"). Every route here requires
MFA-verified authentication AND a system_admin permission — see
core/deps.py require_admin_permission for why both are enforced, not just one."""

from __future__ import annotations

import uuid

from fastapi import APIRouter, Depends, Query
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.deps import get_session, require_admin_permission
from app.core.security.jwt import AccessTokenClaims
from app.repositories import document_repository, session_repository
from app.schemas.admin import (
    AdminCreateUserRequest,
    AdminCreateUserResponse,
    AdminResetPasswordResponse,
    AdminSessionResponse,
    AdminUserStatusRequest,
    SecurityEventResponse,
    StorageUsageResponse,
)
from app.services import admin_service, security_event_service

router = APIRouter(prefix="/admin", tags=["admin"])


@router.post("/users", response_model=AdminCreateUserResponse, status_code=201)
async def create_user(
    body: AdminCreateUserRequest,
    claims: AccessTokenClaims = Depends(require_admin_permission("admin.users.create")),
    session: AsyncSession = Depends(get_session),
) -> AdminCreateUserResponse:
    user, one_time_password = await admin_service.create_user(
        session, alias=body.alias, system_role=body.system_role, created_by=uuid.UUID(claims.sub)
    )
    return AdminCreateUserResponse(id=str(user.id), alias=user.alias, one_time_password=one_time_password)


@router.patch("/users/{user_id}/status", status_code=204)
async def set_user_status(
    user_id: uuid.UUID,
    body: AdminUserStatusRequest,
    claims: AccessTokenClaims = Depends(require_admin_permission("admin.users.disable")),
    session: AsyncSession = Depends(get_session),
) -> None:
    await admin_service.set_user_status(session, user_id=user_id, status=body.status, changed_by=uuid.UUID(claims.sub))


@router.post("/users/{user_id}/reset-password", response_model=AdminResetPasswordResponse)
async def reset_password(
    user_id: uuid.UUID,
    claims: AccessTokenClaims = Depends(require_admin_permission("admin.users.reset_password")),
    session: AsyncSession = Depends(get_session),
) -> AdminResetPasswordResponse:
    one_time_password = await admin_service.reset_password(session, user_id=user_id, reset_by=uuid.UUID(claims.sub))
    return AdminResetPasswordResponse(one_time_password=one_time_password)


@router.delete("/users/{user_id}/mfa", status_code=204)
async def reset_mfa(
    user_id: uuid.UUID,
    claims: AccessTokenClaims = Depends(require_admin_permission("admin.users.mfa.reset")),
    session: AsyncSession = Depends(get_session),
) -> None:
    await admin_service.reset_mfa(session, user_id=user_id, reset_by=uuid.UUID(claims.sub))


@router.get("/sessions", response_model=list[AdminSessionResponse])
async def list_sessions(
    claims: AccessTokenClaims = Depends(require_admin_permission("admin.sessions.view")),
    session: AsyncSession = Depends(get_session),
) -> list[AdminSessionResponse]:
    sessions = await session_repository.list_all_active(session)
    return [
        AdminSessionResponse(
            id=str(s.id), user_id=str(s.user_id), device_id=str(s.device_id), ip_address=s.ip_address,
            issued_at=s.issued_at, expires_at=s.expires_at,
        )
        for s in sessions
    ]


@router.delete("/sessions/{session_id}", status_code=204)
async def revoke_session(
    session_id: uuid.UUID,
    claims: AccessTokenClaims = Depends(require_admin_permission("admin.sessions.revoke")),
    session: AsyncSession = Depends(get_session),
) -> None:
    await admin_service.revoke_session(session, session_id=session_id, revoked_by=uuid.UUID(claims.sub))


@router.delete("/devices/{device_id}", status_code=204)
async def revoke_device(
    device_id: uuid.UUID,
    claims: AccessTokenClaims = Depends(require_admin_permission("admin.devices.revoke")),
    session: AsyncSession = Depends(get_session),
) -> None:
    await admin_service.revoke_device(session, device_id=device_id, revoked_by=uuid.UUID(claims.sub))


@router.post("/organizations/{organization_id}/suspend", status_code=204)
async def suspend_organization(
    organization_id: uuid.UUID,
    claims: AccessTokenClaims = Depends(require_admin_permission("admin.organizations.suspend")),
    session: AsyncSession = Depends(get_session),
) -> None:
    await admin_service.suspend_organization(session, organization_id=organization_id, suspended_by=uuid.UUID(claims.sub))


@router.get("/security-events", response_model=list[SecurityEventResponse])
async def list_security_events(
    event_type: str | None = Query(default=None),
    user_id: uuid.UUID | None = Query(default=None),
    severity: str | None = Query(default=None),
    limit: int = Query(default=100, le=500),
    claims: AccessTokenClaims = Depends(require_admin_permission("admin.security_events.view")),
    session: AsyncSession = Depends(get_session),
) -> list[SecurityEventResponse]:
    events = await security_event_service.list_events(
        session, event_type=event_type, user_id=user_id, severity=severity, limit=limit
    )
    return [
        SecurityEventResponse(
            id=str(e.id), seq=e.seq, event_type=e.event_type, severity=e.severity,
            user_id=str(e.user_id) if e.user_id else None,
            organization_id=str(e.organization_id) if e.organization_id else None,
            ip_address=e.ip_address, metadata=e.metadata_, created_at=e.created_at,
        )
        for e in events
    ]


@router.get("/storage/usage", response_model=StorageUsageResponse)
async def storage_usage(
    claims: AccessTokenClaims = Depends(require_admin_permission("admin.storage.view")),
    session: AsyncSession = Depends(get_session),
) -> StorageUsageResponse:
    total = await document_repository.get_total_storage_usage(session)
    by_org = await document_repository.get_storage_usage_by_org(session)
    return StorageUsageResponse(total_bytes=total, by_organization={str(org_id): n for org_id, n in by_org})
