"""JWT access token issuance/verification (Authentication Design doc §5).

Access tokens are short-lived, signed with EdDSA (Ed25519), and carry an `mfa` claim so
routes requiring step-up authentication can check it without a DB round-trip. Refresh
tokens are NOT JWTs — they are opaque random values, stored hashed server-side
(see services/auth_service.py), so they can be individually revoked and their reuse
detected; a self-contained signed refresh token could not be revoked before expiry.
"""

from __future__ import annotations

import time
import uuid
from dataclasses import dataclass

import jwt

ALGORITHM = "EdDSA"


class TokenError(Exception):
    pass


@dataclass(frozen=True)
class AccessTokenClaims:
    sub: str  # user id
    org_id: str | None
    mfa: bool
    jti: str
    exp: int
    iat: int


def issue_access_token(
    *,
    user_id: str,
    organization_id: str | None,
    mfa_verified: bool,
    private_key_pem: str,
    issuer: str,
    ttl_seconds: int,
) -> str:
    now = int(time.time())
    payload = {
        "sub": user_id,
        "org_id": organization_id,
        "mfa": mfa_verified,
        "jti": str(uuid.uuid4()),
        "iat": now,
        "exp": now + ttl_seconds,
        "iss": issuer,
    }
    return jwt.encode(payload, private_key_pem, algorithm=ALGORITHM)


def verify_access_token(token: str, *, public_key_pem: str, issuer: str) -> AccessTokenClaims:
    try:
        payload = jwt.decode(
            token,
            public_key_pem,
            algorithms=[ALGORITHM],  # strict allow-list — never accept "alg" from the token itself
            issuer=issuer,
            options={"require": ["exp", "iat", "sub", "jti"]},
        )
    except jwt.PyJWTError as exc:
        raise TokenError(str(exc)) from exc

    return AccessTokenClaims(
        sub=payload["sub"],
        org_id=payload.get("org_id"),
        mfa=bool(payload.get("mfa", False)),
        jti=payload["jti"],
        exp=payload["exp"],
        iat=payload["iat"],
    )


def issue_purpose_token(
    *, subject: str, purpose: str, private_key_pem: str, issuer: str, ttl_seconds: int
) -> str:
    """Short-lived, single-purpose tokens (MFA challenge, forced password-change,
    MFA-enrollment-required) that are explicitly NOT valid as access tokens — the
    `typ` claim is checked by the caller and must match, so a challenge token can never
    be replayed against an endpoint expecting a real access token (Threat Model §3.1)."""
    now = int(time.time())
    payload = {
        "sub": subject,
        "typ": purpose,
        "iat": now,
        "exp": now + ttl_seconds,
        "iss": issuer,
    }
    return jwt.encode(payload, private_key_pem, algorithm=ALGORITHM)


def verify_purpose_token(token: str, *, expected_purpose: str, public_key_pem: str, issuer: str) -> str:
    """Returns the subject if valid. Raises TokenError otherwise."""
    try:
        payload = jwt.decode(
            token,
            public_key_pem,
            algorithms=[ALGORITHM],
            issuer=issuer,
            options={"require": ["exp", "iat", "sub", "typ"]},
        )
    except jwt.PyJWTError as exc:
        raise TokenError(str(exc)) from exc

    if payload.get("typ") != expected_purpose:
        raise TokenError("Unexpected token purpose")
    return payload["sub"]
