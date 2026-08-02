"""Signed, single-use, short-TTL download tokens (Encryption Design doc §7 — avoids
ever exposing a public/predictable file URL). The token is opaque to the client; all
fields are re-validated server-side on redemption, including a fresh RBAC check (the
token proves possession, not authorization — authorization is re-checked at
consumption time, not cached into the token itself)."""

from __future__ import annotations

import base64
import hashlib
import hmac
import secrets
import time
import uuid

import redis.asyncio as redis

from app.core.security.crypto import derive_org_kek

_REDEEMED_PREFIX = "download_token_used:"


class DownloadTokenError(Exception):
    pass


def _signing_key(root_secret: bytes, organization_id: uuid.UUID) -> bytes:
    # Org-scoped signing key — a token minted for one org's document can never verify
    # under another org's key, even before the downstream RBAC re-check runs.
    return derive_org_kek(root_secret, f"download-token:{organization_id}")


def issue_download_token(
    *, root_secret: bytes, organization_id: uuid.UUID, document_id: uuid.UUID, version_id: uuid.UUID, ttl_seconds: int
) -> str:
    expiry = int(time.time()) + ttl_seconds
    nonce = secrets.token_urlsafe(12)
    # organization_id travels IN the signed payload — the client's only entry point is
    # GET /downloads/{token} with no other parameters, so the server must be able to
    # learn which org's key to verify against from the token itself. This is safe:
    # tampering the embedded organization_id changes the signed payload, and the
    # attacker doesn't hold the (different) org's signing key needed to produce a
    # matching signature for the tampered payload — see redeem_download_token.
    payload = f"{document_id}|{version_id}|{organization_id}|{expiry}|{nonce}"
    signature = hmac.new(_signing_key(root_secret, organization_id), payload.encode(), hashlib.sha256).hexdigest()
    token = f"{payload}|{signature}"
    return base64.urlsafe_b64encode(token.encode()).decode()


async def redeem_download_token(
    redis_client: redis.Redis, *, root_secret: bytes, token: str
) -> tuple[uuid.UUID, uuid.UUID, uuid.UUID]:
    """Returns (document_id, version_id, organization_id). The caller MUST still run
    a fresh RBAC/membership check against the returned document_id for the requesting
    user before streaming anything — this only proves the token is authentic and
    unused, not that the current bearer is still authorized (Encryption Design §7)."""
    try:
        decoded = base64.urlsafe_b64decode(token.encode()).decode()
        document_id_str, version_id_str, organization_id_str, expiry_str, nonce, signature = decoded.split("|")
    except (ValueError, UnicodeDecodeError) as exc:
        raise DownloadTokenError("Malformed token") from exc

    try:
        organization_id = uuid.UUID(organization_id_str)
    except ValueError as exc:
        raise DownloadTokenError("Malformed token") from exc

    payload = f"{document_id_str}|{version_id_str}|{organization_id_str}|{expiry_str}|{nonce}"
    expected_signature = hmac.new(
        _signing_key(root_secret, organization_id), payload.encode(), hashlib.sha256
    ).hexdigest()
    if not hmac.compare_digest(signature, expected_signature):
        raise DownloadTokenError("Invalid signature")

    if int(expiry_str) < int(time.time()):
        raise DownloadTokenError("Token expired")

    # Single-use: the nonce is claimed atomically (NX) the first and only time this
    # token is redeemed; a replayed token — even a still-unexpired one — is rejected.
    remaining_ttl = max(int(expiry_str) - int(time.time()), 0) + 5
    claimed = await redis_client.set(f"{_REDEEMED_PREFIX}{nonce}", "1", nx=True, ex=remaining_ttl)
    if not claimed:
        raise DownloadTokenError("Token already used")

    return uuid.UUID(document_id_str), uuid.UUID(version_id_str), organization_id
