"""Signed, single-use, short-TTL view tokens for chat attachments — same pattern as
app.core.download_tokens, kept as a separate module (rather than a shared/generalized
one) because the two token kinds carry different payload shapes (document+version vs.
attachment) and are redeemed against different membership checks (project access vs.
channel membership) — see app/api/v1/messages.py's redeem route for the channel check.
"""

from __future__ import annotations

import base64
import hashlib
import hmac
import secrets
import time
import uuid

import redis.asyncio as redis

from app.core.security.crypto import derive_org_kek

_REDEEMED_PREFIX = "attachment_token_used:"


class AttachmentTokenError(Exception):
    pass


def _signing_key(root_secret: bytes, organization_id: uuid.UUID) -> bytes:
    return derive_org_kek(root_secret, f"attachment-token:{organization_id}")


def issue_attachment_view_token(
    *, root_secret: bytes, organization_id: uuid.UUID, attachment_id: uuid.UUID, ttl_seconds: int
) -> str:
    expiry = int(time.time()) + ttl_seconds
    nonce = secrets.token_urlsafe(12)
    payload = f"{attachment_id}|{organization_id}|{expiry}|{nonce}"
    signature = hmac.new(_signing_key(root_secret, organization_id), payload.encode(), hashlib.sha256).hexdigest()
    token = f"{payload}|{signature}"
    return base64.urlsafe_b64encode(token.encode()).decode()


async def redeem_attachment_view_token(
    redis_client: redis.Redis, *, root_secret: bytes, token: str
) -> tuple[uuid.UUID, uuid.UUID]:
    """Returns (attachment_id, organization_id). Same caveat as redeem_download_token:
    proves the token is authentic/unused, not that the bearer is still authorized —
    the caller must re-check live channel membership before streaming anything."""
    try:
        decoded = base64.urlsafe_b64decode(token.encode()).decode()
        attachment_id_str, organization_id_str, expiry_str, nonce, signature = decoded.split("|")
    except (ValueError, UnicodeDecodeError) as exc:
        raise AttachmentTokenError("Malformed token") from exc

    try:
        organization_id = uuid.UUID(organization_id_str)
    except ValueError as exc:
        raise AttachmentTokenError("Malformed token") from exc

    payload = f"{attachment_id_str}|{organization_id_str}|{expiry_str}|{nonce}"
    expected_signature = hmac.new(
        _signing_key(root_secret, organization_id), payload.encode(), hashlib.sha256
    ).hexdigest()
    if not hmac.compare_digest(signature, expected_signature):
        raise AttachmentTokenError("Invalid signature")

    if int(expiry_str) < int(time.time()):
        raise AttachmentTokenError("Token expired")

    remaining_ttl = max(int(expiry_str) - int(time.time()), 0) + 5
    claimed = await redis_client.set(f"{_REDEEMED_PREFIX}{nonce}", "1", nx=True, ex=remaining_ttl)
    if not claimed:
        raise AttachmentTokenError("Token already used")

    return uuid.UUID(attachment_id_str), organization_id
