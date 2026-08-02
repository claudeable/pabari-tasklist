"""Login, MFA, token refresh, logout, password change (Authentication Design doc).

Every branch here is deliberately explicit about what it discloses to the caller —
see the inline notes at each decision point; this is the module where an enumeration
or lockout-oracle bug would live if introduced carelessly.
"""

from __future__ import annotations

import hashlib
import secrets
import uuid
from dataclasses import dataclass
from datetime import UTC, datetime, timedelta

from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import Settings
from app.core.security import mfa as mfa_lib
from app.core.security.jwt import TokenError, issue_access_token, issue_purpose_token, verify_purpose_token
from app.core.security.passwords import hash_password, needs_rehash, verify_password
from app.domain.enums import SecurityEventSeverity, SecurityEventType, SystemRole, UserStatus
from app.domain.models.user import User
from app.repositories import device_repository, session_repository, user_repository
from app.services.security_event_service import record_security_event

PURPOSE_MFA_CHALLENGE = "mfa_challenge"
PURPOSE_PASSWORD_CHANGE_REQUIRED = "password_change_required"
PURPOSE_MFA_ENROLLMENT_REQUIRED = "mfa_enrollment_required"

_ROLES_REQUIRING_MFA = {SystemRole.system_admin.value}


class AuthError(Exception):
    """Generic authentication failure — callers must map this to a single, uniform
    401 response regardless of which branch below raised it (Authentication Design §6:
    identical response for unknown-alias vs wrong-password)."""


class AccountLockedError(Exception):
    """Raised only after the password has already been verified correct — disclosing
    lock state pre-password-check would create an enumeration oracle."""

    def __init__(self, locked_until: datetime) -> None:
        self.locked_until = locked_until


@dataclass(frozen=True)
class LoginOutcome:
    status: str
    challenge_token: str | None = None
    access_token: str | None = None
    refresh_token: str | None = None
    expires_in: int | None = None
    user_id: str | None = None


def _mfa_required(user: User) -> bool:
    return user.system_role in _ROLES_REQUIRING_MFA


def _lockout_duration_minutes(settings: Settings, failed_count: int) -> int | None:
    schedule = settings.lockout_schedule_minutes
    if failed_count < len(schedule) + 1:
        # First `len(schedule)` *thresholds* map 1:1 to escalating durations; below the
        # first threshold there is no lockout yet.
        index = failed_count - 1
        if index < 0:
            return None
        if index < len(schedule):
            return schedule[index]
        return schedule[-1]
    return schedule[-1]


def _hash_refresh_token(token: str) -> str:
    return hashlib.sha256(token.encode()).hexdigest()


def _generate_refresh_token() -> str:
    return secrets.token_urlsafe(32)


async def _issue_session(
    session: AsyncSession,
    settings: Settings,
    *,
    user: User,
    device_id: uuid.UUID,
    ip_address: str,
    user_agent: str | None,
    mfa_verified: bool,
    rotated_from: uuid.UUID | None = None,
) -> tuple[str, str, int]:
    refresh_token = _generate_refresh_token()
    expires_at = datetime.now(UTC) + timedelta(seconds=settings.jwt_refresh_ttl_seconds)

    await session_repository.create(
        session,
        user_id=user.id,
        device_id=device_id,
        refresh_token_hash=_hash_refresh_token(refresh_token),
        ip_address=ip_address,
        user_agent=user_agent,
        expires_at=expires_at,
        rotated_from=rotated_from,
    )

    private_key = settings.resolve_secret(settings.jwt_private_key, settings.jwt_private_key_path, "jwt_private_key")
    access_token = issue_access_token(
        user_id=str(user.id),
        organization_id=None,
        mfa_verified=mfa_verified,
        private_key_pem=private_key,
        issuer=settings.jwt_issuer,
        ttl_seconds=settings.jwt_access_ttl_seconds,
    )
    return access_token, refresh_token, settings.jwt_access_ttl_seconds


async def login(
    session: AsyncSession,
    settings: Settings,
    *,
    alias: str,
    password: str,
    device_fingerprint: str,
    device_name: str | None,
    ip_address: str,
    user_agent: str | None,
) -> LoginOutcome:
    # Row-locked so concurrent login attempts against the same account (a distributed
    # brute-force burst) can't lose failed_login_count/locked_until updates to a race
    # (Pentest Checklist §1).
    user = await user_repository.get_by_alias_for_update(session, alias)

    # verify_password always performs a real hash operation even when user is None
    # (constant-time-ish w.r.t. account existence — Authentication Design §6).
    password_ok = verify_password(password, user.password_hash if user else None)

    if not password_ok:
        if user is not None:
            user.failed_login_count += 1
            duration = _lockout_duration_minutes(settings, user.failed_login_count)
            if duration is not None:
                user.locked_until = datetime.now(UTC) + timedelta(minutes=duration)
            await record_security_event(
                session,
                event_type=SecurityEventType.login_failed.value,
                user_id=user.id,
                ip_address=ip_address,
            )
        else:
            await record_security_event(
                session,
                event_type=SecurityEventType.login_failed.value,
                ip_address=ip_address,
                metadata={"reason": "unknown_alias"},
            )
        raise AuthError("Invalid credentials")

    assert user is not None  # password_ok is only True when user exists

    if user.status != UserStatus.active.value:
        # Deliberately the SAME generic error as a lockout for a disabled account —
        # only lockout specifically gets its own disclosure per §6; disabled does not.
        raise AuthError("Invalid credentials")

    if user.locked_until is not None and user.locked_until > datetime.now(UTC):
        await record_security_event(
            session,
            event_type=SecurityEventType.lockout.value,
            user_id=user.id,
            severity=SecurityEventSeverity.warning.value,
            ip_address=ip_address,
        )
        raise AccountLockedError(user.locked_until)

    # Correct password, not locked: reset failure counter and continue.
    user.failed_login_count = 0
    user.locked_until = None
    if needs_rehash(user.password_hash):
        user.password_hash = hash_password(password)

    device = await device_repository.get_or_create(session, user.id, device_fingerprint, device_name)

    private_key = settings.resolve_secret(settings.jwt_private_key, settings.jwt_private_key_path, "jwt_private_key")

    if settings.force_password_change and user.must_change_password:
        token = issue_purpose_token(
            subject=str(user.id),
            purpose=PURPOSE_PASSWORD_CHANGE_REQUIRED,
            private_key_pem=private_key,
            issuer=settings.jwt_issuer,
            ttl_seconds=settings.mfa_challenge_ttl_seconds,
        )
        return LoginOutcome(status="password_change_required", challenge_token=token, user_id=str(user.id))

    if settings.mfa_enforced and _mfa_required(user) and not user.mfa_enabled:
        token = issue_purpose_token(
            subject=str(user.id),
            purpose=PURPOSE_MFA_ENROLLMENT_REQUIRED,
            private_key_pem=private_key,
            issuer=settings.jwt_issuer,
            ttl_seconds=settings.mfa_challenge_ttl_seconds,
        )
        return LoginOutcome(status="mfa_enrollment_required", challenge_token=token, user_id=str(user.id))

    if settings.mfa_enforced and user.mfa_enabled:
        token = issue_purpose_token(
            subject=str(user.id),
            purpose=PURPOSE_MFA_CHALLENGE,
            private_key_pem=private_key,
            issuer=settings.jwt_issuer,
            ttl_seconds=settings.mfa_challenge_ttl_seconds,
        )
        return LoginOutcome(status="mfa_required", challenge_token=token, user_id=str(user.id))

    access_token, refresh_token, ttl = await _issue_session(
        session,
        settings,
        user=user,
        device_id=device.id,
        ip_address=ip_address,
        user_agent=user_agent,
        mfa_verified=False,
    )
    await record_security_event(
        session, event_type=SecurityEventType.login_success.value, user_id=user.id, ip_address=ip_address
    )
    return LoginOutcome(
        status="authenticated",
        access_token=access_token,
        refresh_token=refresh_token,
        expires_in=ttl,
        user_id=str(user.id),
    )


async def verify_mfa(
    session: AsyncSession,
    settings: Settings,
    *,
    challenge_token: str,
    totp_code: str,
    device_fingerprint: str,
    device_name: str | None,
    ip_address: str,
    user_agent: str | None,
) -> LoginOutcome:
    public_key = settings.resolve_secret(settings.jwt_public_key, settings.jwt_public_key_path, "jwt_public_key")
    try:
        user_id = verify_purpose_token(
            challenge_token, expected_purpose=PURPOSE_MFA_CHALLENGE, public_key_pem=public_key, issuer=settings.jwt_issuer
        )
    except TokenError as exc:
        raise AuthError("Invalid or expired challenge") from exc

    # Row-locked for the duration of the check-and-set on totp_last_step — without
    # this, two concurrent requests with the same code could both read the old step
    # before either writes the new one, defeating replay protection (Pentest
    # Checklist §1 "race condition submitting two codes simultaneously").
    user = await user_repository.get_by_id_for_update(session, uuid.UUID(user_id))
    if user is None or not user.mfa_enabled or user.totp_secret_encrypted is None:
        raise AuthError("Invalid or expired challenge")

    is_valid, step_used = mfa_lib.verify_totp_code(
        _decrypt_totp_secret(settings, user),
        totp_code,
        last_used_step=user.totp_last_step,
        valid_window=settings.totp_valid_window,
    )
    if not is_valid:
        user.failed_login_count += 1
        duration = _lockout_duration_minutes(settings, user.failed_login_count)
        if duration is not None:
            user.locked_until = datetime.now(UTC) + timedelta(minutes=duration)
        await record_security_event(
            session, event_type=SecurityEventType.mfa_failed.value, user_id=user.id, ip_address=ip_address
        )
        raise AuthError("Invalid code")

    user.totp_last_step = step_used
    user.failed_login_count = 0
    user.locked_until = None

    device = await device_repository.get_or_create(session, user.id, device_fingerprint, device_name)
    access_token, refresh_token, ttl = await _issue_session(
        session,
        settings,
        user=user,
        device_id=device.id,
        ip_address=ip_address,
        user_agent=user_agent,
        mfa_verified=True,
    )
    await record_security_event(
        session, event_type=SecurityEventType.mfa_success.value, user_id=user.id, ip_address=ip_address
    )
    await record_security_event(
        session, event_type=SecurityEventType.login_success.value, user_id=user.id, ip_address=ip_address
    )
    return LoginOutcome(
        status="authenticated",
        access_token=access_token,
        refresh_token=refresh_token,
        expires_in=ttl,
        user_id=str(user.id),
    )


def _decrypt_totp_secret(settings: Settings, user: User) -> str:
    from app.core.security.crypto import decrypt_for_subject

    assert user.totp_secret_encrypted is not None
    root_secret = resolve_root_secret(settings)
    return decrypt_for_subject(root_secret, f"user:{user.id}", user.totp_secret_encrypted).decode()


def resolve_root_secret(settings: Settings) -> bytes:
    if settings.root_secret_path:
        with open(settings.root_secret_path, "rb") as f:
            return f.read().strip()
    if settings.root_secret:
        return settings.root_secret.encode()
    raise RuntimeError("No root secret configured")


async def refresh_session(
    session: AsyncSession,
    settings: Settings,
    *,
    refresh_token: str,
    ip_address: str,
    user_agent: str | None,
) -> tuple[str, str, int]:
    token_hash = _hash_refresh_token(refresh_token)
    existing = await session_repository.get_by_refresh_hash(session, token_hash)

    if existing is None:
        raise AuthError("Invalid session")

    if existing.revoked_at is not None:
        # Reuse of an already-rotated (or already-revoked) refresh token — assume
        # compromise and kill the entire rotation family (Authentication Design §5).
        revoked_count = await session_repository.revoke_chain_from(session, existing.id)
        await record_security_event(
            session,
            event_type=SecurityEventType.refresh_token_reuse_detected.value,
            user_id=existing.user_id,
            severity=SecurityEventSeverity.critical.value,
            ip_address=ip_address,
            metadata={"revoked_sessions": revoked_count},
        )
        raise AuthError("Invalid session")

    if existing.expires_at <= datetime.now(UTC):
        raise AuthError("Session expired")

    user = await user_repository.get_by_id(session, existing.user_id)
    if user is None or user.status != UserStatus.active.value:
        raise AuthError("Invalid session")

    existing.revoked_at = datetime.now(UTC)

    access_token, new_refresh_token, ttl = await _issue_session(
        session,
        settings,
        user=user,
        device_id=existing.device_id,
        ip_address=ip_address,
        user_agent=user_agent,
        mfa_verified=user.mfa_enabled,
        rotated_from=existing.id,
    )
    return access_token, new_refresh_token, ttl


async def logout(session: AsyncSession, *, refresh_token: str) -> None:
    token_hash = _hash_refresh_token(refresh_token)
    existing = await session_repository.get_by_refresh_hash(session, token_hash)
    if existing is not None and existing.revoked_at is None:
        await session_repository.revoke(session, existing.id)
        await record_security_event(
            session, event_type=SecurityEventType.session_revoked.value, user_id=existing.user_id
        )


async def logout_all(session: AsyncSession, *, user_id: uuid.UUID) -> None:
    await session_repository.revoke_all_for_user(session, user_id)
    await record_security_event(session, event_type=SecurityEventType.session_revoked.value, user_id=user_id)


async def change_password(
    session: AsyncSession, *, user: User, current_password: str, new_password: str
) -> None:
    if not verify_password(current_password, user.password_hash):
        raise AuthError("Current password is incorrect")

    recent_hashes = await user_repository.get_recent_password_hashes(session, user.id)
    for old_hash in recent_hashes:
        if verify_password(new_password, old_hash):
            raise AuthError("Password was used recently; choose a different password")

    await user_repository.record_password_history(session, user.id, user.password_hash)
    user.password_hash = hash_password(new_password)
    user.must_change_password = False

    await record_security_event(session, event_type=SecurityEventType.password_changed.value, user_id=user.id)


async def start_mfa_enrollment(settings: Settings, *, user: User) -> tuple[str, str]:
    """Returns (secret, provisioning_uri). The secret is NOT persisted until
    `confirm_mfa_enrollment` succeeds — an abandoned enrollment leaves no encrypted
    secret sitting unused in the database."""
    secret = mfa_lib.generate_totp_secret()
    uri = mfa_lib.provisioning_uri(secret, alias=user.alias)
    return secret, uri


async def confirm_mfa_enrollment(
    session: AsyncSession, settings: Settings, *, user: User, secret: str, totp_code: str
) -> list[str]:
    from app.core.security.crypto import encrypt_for_subject
    from app.domain.models.user import BackupCode

    is_valid, step_used = mfa_lib.verify_totp_code(
        secret, totp_code, last_used_step=None, valid_window=settings.totp_valid_window
    )
    if not is_valid:
        raise AuthError("Invalid code")

    root_secret = resolve_root_secret(settings)
    user.totp_secret_encrypted = encrypt_for_subject(root_secret, f"user:{user.id}", secret.encode())
    user.totp_last_step = step_used
    user.mfa_enabled = True

    backup_codes = mfa_lib.generate_backup_codes()
    pepper = root_secret
    for code in backup_codes:
        session.add(BackupCode(user_id=user.id, code_hash=mfa_lib.hash_backup_code(code, pepper=pepper)))

    await record_security_event(
        session, event_type=SecurityEventType.mfa_success.value, user_id=user.id, metadata={"action": "enrolled"}
    )
    return backup_codes
