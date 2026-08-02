"""Notification endpoints (API Specification doc "Notifications")."""

from __future__ import annotations

import uuid

from fastapi import APIRouter, Depends, Query
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.deps import get_current_claims, get_user_scoped_session
from app.core.errors import ResourceNotFoundError
from app.core.security.jwt import AccessTokenClaims
from app.repositories import notification_repository
from app.schemas.notification import NotificationResponse

router = APIRouter(prefix="/notifications", tags=["notifications"])


@router.get("", response_model=list[NotificationResponse])
async def list_notifications(
    unread: bool = Query(default=False),
    claims: AccessTokenClaims = Depends(get_current_claims),
    session: AsyncSession = Depends(get_user_scoped_session),
) -> list[NotificationResponse]:
    notifications = await notification_repository.list_for_user(session, uuid.UUID(claims.sub), unread_only=unread)
    return [NotificationResponse.model_validate(n) for n in notifications]


@router.post("/{notification_id}/read", status_code=204)
async def mark_read(
    notification_id: uuid.UUID,
    claims: AccessTokenClaims = Depends(get_current_claims),
    session: AsyncSession = Depends(get_user_scoped_session),
) -> None:
    updated = await notification_repository.mark_read(session, notification_id=notification_id, user_id=uuid.UUID(claims.sub))
    if not updated:
        # Either it doesn't exist, belongs to someone else, or is already read — all
        # three collapse to the same response so ownership can't be probed by ID.
        existing = await notification_repository.get_by_id(session, notification_id)
        if existing is None or existing.recipient_id != uuid.UUID(claims.sub):
            raise ResourceNotFoundError()


@router.post("/read-all", status_code=204)
async def mark_all_read(
    claims: AccessTokenClaims = Depends(get_current_claims), session: AsyncSession = Depends(get_user_scoped_session)
) -> None:
    await notification_repository.mark_all_read(session, user_id=uuid.UUID(claims.sub))
