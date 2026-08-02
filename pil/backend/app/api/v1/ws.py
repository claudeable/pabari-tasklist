"""WebSocket gateway (API Specification doc "Channels & Messages": WS /ws?ticket=...)."""

from __future__ import annotations

import base64
import json
import uuid

import structlog
from fastapi import APIRouter, Depends, Request, WebSocket, WebSocketDisconnect
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import Settings, get_settings
from app.core.deps import get_channel_scoped_session, get_current_claims
from app.core.errors import RateLimitedError
from app.core.presence import mark_connected, mark_disconnected
from app.core.rate_limit import RateLimiter
from app.core.security.jwt import AccessTokenClaims
from app.core.ws_manager import channel_topic, issue_ticket, redeem_ticket
from app.repositories import channel_repository
from app.services import chat_service
from app.services.rbac_service import user_can_access_project

logger = structlog.get_logger(__name__)

router = APIRouter(tags=["ws"])


@router.post("/channels/{channel_id}/ws-ticket")
async def create_ws_ticket(
    channel_id: uuid.UUID,
    request: Request,
    claims: AccessTokenClaims = Depends(get_current_claims),
    session: AsyncSession = Depends(get_channel_scoped_session),
    settings: Settings = Depends(get_settings),
) -> dict[str, str]:
    # get_channel_scoped_session already verified read-level access to this channel's
    # project — issuing a ticket requires nothing further beyond rate limiting (even
    # read_only/guest may connect to receive messages, matching their view-level
    # access). Rate limit is on ticket issuance, not the WS connection itself, since
    # that's the authenticated, attributable choke point (Security Architecture §7:
    # "WebSocket connects: 10/min per user" — Pentest Checklist §7 resource exhaustion).
    limiter = RateLimiter(request.app.state.redis)
    result = await limiter.check(
        f"ws-connect:{claims.sub}", limit=settings.ws_connect_rate_limit_per_minute, window_seconds=60
    )
    if not result.allowed:
        raise RateLimitedError()

    ticket = await issue_ticket(request.app.state.redis, user_id=uuid.UUID(claims.sub), channel_id=channel_id)
    return {"ticket": ticket}


@router.websocket("/ws")
async def websocket_endpoint(
    websocket: WebSocket, ticket: str, settings: Settings = Depends(get_settings)
) -> None:
    redis_client = websocket.app.state.redis

    redeemed = await redeem_ticket(redis_client, ticket=ticket)
    if redeemed is None:
        await websocket.close(code=4401)  # policy: invalid/expired/already-used ticket
        return
    user_id, channel_id = redeemed

    session_factory = websocket.app.state.session_factory

    # Fresh re-verification at connect time — access could have been revoked in the
    # (short) window since the ticket was issued (Pentest Checklist §7).
    async with session_factory() as bootstrap_session:
        organization_id = await channel_repository.get_organization_id_for_channel(bootstrap_session, channel_id)
    if organization_id is None:
        await websocket.close(code=4404)
        return

    from app.core.db import tenant_scoped_session

    async with tenant_scoped_session(
        session_factory, user_id=str(user_id), organization_id=str(organization_id)
    ) as session:
        channel = await channel_repository.get_by_id(session, channel_id)
        if channel is None:
            await websocket.close(code=4404)
            return
        if not await user_can_access_project(
            session, user_id=user_id, project_id=channel.project_id, organization_id=organization_id
        ):
            await websocket.close(code=4403)
            return
        if channel.is_private and not await channel_repository.is_member(session, channel_id, user_id):
            await websocket.close(code=4403)
            return

    await websocket.accept()
    await mark_connected(redis_client, user_id)

    pubsub = redis_client.pubsub()
    await pubsub.subscribe(channel_topic(channel_id))

    try:
        async for raw_message in pubsub.listen():
            if raw_message["type"] != "message":
                continue
            event = json.loads(raw_message["data"])
            try:
                plaintext = chat_service.decrypt_body(
                    settings,
                    channel,
                    organization_id,
                    base64.b64decode(event["ciphertext"]),
                    base64.b64decode(event["nonce"]),
                )
            except Exception:
                # Never forward a raw decryption failure/traceback to the client
                # (Security Architecture doc — no internal detail leakage) — but DO
                # log it server-side; silently dropping every such event would hide
                # a real bug or tampering attempt from anyone operating this system.
                logger.warning(
                    "ws_message_decrypt_failed", channel_id=str(channel_id), message_id=event.get("message_id")
                )
                continue
            await websocket.send_json(
                {
                    "type": event["type"],
                    "message_id": event["message_id"],
                    "author_id": event["author_id"],
                    "channel_id": event["channel_id"],
                    "body": plaintext,
                    "created_at": event["created_at"],
                }
            )
    except WebSocketDisconnect:
        pass
    finally:
        await pubsub.unsubscribe(channel_topic(channel_id))
        await pubsub.aclose()
        await mark_disconnected(redis_client, user_id)
