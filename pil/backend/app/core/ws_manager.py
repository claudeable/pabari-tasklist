"""WebSocket ticket issuance/redemption and Redis pub/sub fan-out (Authentication
Design doc §3.1 WS ticket flow was chat-specific in the original design; concretely:
short-lived, single-use ticket issued over an authenticated REST call, never the raw
JWT in a query string — Encryption Design doc note that Redis never holds plaintext
content extends to chat: only ciphertext+nonce cross the pub/sub bus, decrypted
per-connection by the worker actually holding an authorized subscriber)."""

from __future__ import annotations

import json
import secrets
import uuid

import redis.asyncio as redis

_TICKET_PREFIX = "ws_ticket:"
_TICKET_TTL_SECONDS = 30


async def issue_ticket(redis_client: redis.Redis, *, user_id: uuid.UUID, channel_id: uuid.UUID) -> str:
    ticket = secrets.token_urlsafe(32)
    await redis_client.set(
        f"{_TICKET_PREFIX}{ticket}", f"{user_id}:{channel_id}", ex=_TICKET_TTL_SECONDS, nx=True
    )
    return ticket


async def redeem_ticket(redis_client: redis.Redis, *, ticket: str) -> tuple[uuid.UUID, uuid.UUID] | None:
    """Atomic fetch-and-delete — a ticket is valid for exactly one connection attempt,
    successful or not, closing the window for a captured ticket to be replayed."""
    raw = await redis_client.getdel(f"{_TICKET_PREFIX}{ticket}")
    if raw is None:
        return None
    user_id_str, channel_id_str = raw.split(":", 1)
    return uuid.UUID(user_id_str), uuid.UUID(channel_id_str)


def channel_topic(channel_id: uuid.UUID) -> str:
    return f"channel:{channel_id}"


async def publish_message_event(
    redis_client: redis.Redis,
    *,
    channel_id: uuid.UUID,
    message_id: uuid.UUID,
    author_id: uuid.UUID,
    ciphertext_b64: str,
    nonce_b64: str,
    created_at_iso: str,
    event_type: str = "message.created",
) -> None:
    payload = json.dumps(
        {
            "type": event_type,
            "message_id": str(message_id),
            "author_id": str(author_id),
            "channel_id": str(channel_id),
            "ciphertext": ciphertext_b64,
            "nonce": nonce_b64,
            "created_at": created_at_iso,
        }
    )
    await redis_client.publish(channel_topic(channel_id), payload)
