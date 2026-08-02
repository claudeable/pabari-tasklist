"""TOTP MFA (RFC 6238) — see Authentication Design doc §3 and §3.1 (WebAuthn for
privileged roles supersedes TOTP for System Administrator; this module remains the
implementation for TOTP-tier roles and as an admin fallback factor)."""

from __future__ import annotations

import hashlib
import hmac
import secrets
from datetime import UTC, datetime

import pyotp


def generate_totp_secret() -> str:
    return pyotp.random_base32()


def provisioning_uri(secret: str, *, alias: str, issuer: str = "SCV") -> str:
    return pyotp.TOTP(secret).provisioning_uri(name=alias, issuer_name=issuer)


def verify_totp_code(
    secret: str, code: str, *, last_used_step: int | None = None, valid_window: int = 1
) -> tuple[bool, int]:
    """Returns (is_valid, step_used). Caller must persist step_used and reject any code
    whose step is <= last_used_step to prevent replay of a captured code within its
    validity window.

    valid_window=1 (±30s) is the production default — wide enough for normal minor
    clock drift, narrow enough that a captured code has almost no useful shelf life.
    It's a parameter, not hardcoded, so a deployment can widen it (via
    Settings.totp_valid_window) for environments with looser clock sync, without
    editing this function — see the Authentication Design doc's TOTP section."""
    totp = pyotp.TOTP(secret)
    # pyotp's timecode() expects a datetime, not a raw Unix-timestamp float — passing
    # time.time() directly raised AttributeError deep inside pyotp (it does
    # for_time.tzinfo internally), only surfaced by actually running the MFA flow
    # against real TOTP codes, not by any static check.
    current_step = int(totp.timecode(datetime.now(UTC)))
    if last_used_step is not None and current_step <= last_used_step:
        return False, current_step
    is_valid = totp.verify(code, valid_window=valid_window)
    return is_valid, current_step


def generate_backup_codes(count: int = 10) -> list[str]:
    return [secrets.token_hex(5) for _ in range(count)]


def hash_backup_code(code: str, *, pepper: bytes) -> str:
    # Backup codes are single-use, high-entropy random values, not user-chosen passwords —
    # HMAC-SHA256 with a server-side pepper is appropriate (Argon2's slow-hash property is
    # not needed here since brute-forcing is already infeasible against 10-hex-char entropy).
    return hmac.new(pepper, code.encode(), hashlib.sha256).hexdigest()
