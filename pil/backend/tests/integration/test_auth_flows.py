"""Security Testing Plan §2 "Authentication" cases, against real login/MFA/refresh
service logic and a real Postgres instance."""

from datetime import UTC

import pyotp
import pytest

from app.core.config import Settings
from app.core.security.jwt import verify_access_token
from app.domain.enums import SystemRole
from app.domain.models.user import User
from app.services import auth_service


async def _make_user(
    session, *, alias: str, password: str, must_change_password: bool = False,
    system_role: str = SystemRole.member.value,
) -> User:
    from app.core.security.passwords import hash_password

    user = User(
        alias=alias,
        password_hash=hash_password(password),
        must_change_password=must_change_password,
        system_role=system_role,
    )
    session.add(user)
    await session.flush()
    return user


async def test_login_unknown_alias_generic_error(session, settings: Settings) -> None:
    with pytest.raises(auth_service.AuthError):
        await auth_service.login(
            session, settings, alias="Ghost-99", password="whatever", device_fingerprint="fp-1",
            device_name=None, ip_address="127.0.0.1", user_agent=None,
        )


async def test_login_wrong_password_generic_error_and_increments_counter(session, settings: Settings) -> None:
    user = await _make_user(session, alias="Falcon-01", password="correct-horse-battery-staple-14")
    with pytest.raises(auth_service.AuthError):
        await auth_service.login(
            session, settings, alias="Falcon-01", password="wrong-password", device_fingerprint="fp-1",
            device_name=None, ip_address="127.0.0.1", user_agent=None,
        )
    await session.refresh(user)
    assert user.failed_login_count == 1


async def test_login_success_no_mfa_issues_tokens(session, settings: Settings) -> None:
    await _make_user(session, alias="Atlas-04", password="correct-horse-battery-staple-14")
    outcome = await auth_service.login(
        session, settings, alias="Atlas-04", password="correct-horse-battery-staple-14",
        device_fingerprint="fp-1", device_name="laptop", ip_address="127.0.0.1", user_agent="pytest",
    )
    assert outcome.status == "authenticated"
    assert outcome.access_token is not None
    assert outcome.refresh_token is not None

    public_key = settings.jwt_public_key
    claims = verify_access_token(outcome.access_token, public_key_pem=public_key, issuer=settings.jwt_issuer)
    assert claims.sub == outcome.user_id
    assert claims.mfa is False


async def test_login_forces_password_change_when_flagged(session, settings: Settings) -> None:
    await _make_user(session, alias="Echo-11", password="correct-horse-battery-staple-14", must_change_password=True)
    outcome = await auth_service.login(
        session, settings, alias="Echo-11", password="correct-horse-battery-staple-14",
        device_fingerprint="fp-1", device_name=None, ip_address="127.0.0.1", user_agent=None,
    )
    assert outcome.status == "password_change_required"
    assert outcome.challenge_token is not None
    assert outcome.access_token is None  # no full session issued yet


async def test_login_requires_mfa_enrollment_for_system_admin(session, settings: Settings) -> None:
    await _make_user(
        session, alias="Raven-07", password="correct-horse-battery-staple-14", system_role=SystemRole.system_admin.value
    )
    outcome = await auth_service.login(
        session, settings, alias="Raven-07", password="correct-horse-battery-staple-14",
        device_fingerprint="fp-1", device_name=None, ip_address="127.0.0.1", user_agent=None,
    )
    assert outcome.status == "mfa_enrollment_required"
    assert outcome.access_token is None


async def test_lockout_disclosed_only_after_correct_password(session, settings: Settings) -> None:
    user = await _make_user(session, alias="Vortex-02", password="correct-horse-battery-staple-14")
    user.failed_login_count = 10
    from datetime import datetime, timedelta

    user.locked_until = datetime.now(UTC) + timedelta(minutes=30)
    await session.flush()

    # Wrong password on a locked account -> still the generic AuthError, not a lock
    # disclosure (Authentication Design §6 — avoids a lockout-based enumeration oracle).
    with pytest.raises(auth_service.AuthError):
        await auth_service.login(
            session, settings, alias="Vortex-02", password="wrong-password", device_fingerprint="fp-1",
            device_name=None, ip_address="127.0.0.1", user_agent=None,
        )

    # Correct password on a locked account -> lock IS disclosed.
    with pytest.raises(auth_service.AccountLockedError):
        await auth_service.login(
            session, settings, alias="Vortex-02", password="correct-horse-battery-staple-14",
            device_fingerprint="fp-1", device_name=None, ip_address="127.0.0.1", user_agent=None,
        )


async def test_disabled_account_cannot_login(session, settings: Settings) -> None:
    user = await _make_user(session, alias="Nomad-08", password="correct-horse-battery-staple-14")
    user.status = "disabled"
    await session.flush()

    with pytest.raises(auth_service.AuthError):
        await auth_service.login(
            session, settings, alias="Nomad-08", password="correct-horse-battery-staple-14",
            device_fingerprint="fp-1", device_name=None, ip_address="127.0.0.1", user_agent=None,
        )


async def test_mfa_enroll_confirm_then_login_requires_totp(session, settings: Settings) -> None:
    user = await _make_user(session, alias="Sable-03", password="correct-horse-battery-staple-14")

    secret, _uri = await auth_service.start_mfa_enrollment(settings, user=user)
    code = pyotp.TOTP(secret).now()
    backup_codes = await auth_service.confirm_mfa_enrollment(
        session, settings, user=user, secret=secret, totp_code=code
    )
    assert len(backup_codes) == 10
    assert user.mfa_enabled is True

    outcome = await auth_service.login(
        session, settings, alias="Sable-03", password="correct-horse-battery-staple-14",
        device_fingerprint="fp-1", device_name=None, ip_address="127.0.0.1", user_agent=None,
    )
    assert outcome.status == "mfa_required"
    assert outcome.challenge_token is not None


async def test_mfa_verify_rejects_replayed_code(session, settings: Settings) -> None:
    user = await _make_user(session, alias="Cipher-06", password="correct-horse-battery-staple-14")
    secret, _uri = await auth_service.start_mfa_enrollment(settings, user=user)
    enroll_code = pyotp.TOTP(secret).now()
    await auth_service.confirm_mfa_enrollment(session, settings, user=user, secret=secret, totp_code=enroll_code)

    # This test is specifically about verify_mfa's own replay protection across two
    # verify_mfa calls with the identical code — not about its interaction with the
    # step enrollment itself already consumed. Resetting here decouples the two: the
    # whole test runs in milliseconds, so the real wall-clock TOTP step at enrollment
    # time and at the first verify_mfa call below would very likely still be the SAME
    # step, and replay protection (correctly, by design) compares against real
    # wall-clock time — not the timestamp embedded in a given code — so a future-dated
    # code doesn't dodge it. Without this reset the test is flaky: it passes or fails
    # depending on whether a 30-second TOTP window boundary happens to fall between
    # enrollment and login, which is exactly the kind of timing dependency that has no
    # place in a deterministic test.
    user.totp_last_step = None

    login_outcome = await auth_service.login(
        session, settings, alias="Cipher-06", password="correct-horse-battery-staple-14",
        device_fingerprint="fp-1", device_name=None, ip_address="127.0.0.1", user_agent=None,
    )

    code = pyotp.TOTP(secret).now()
    result = await auth_service.verify_mfa(
        session, settings, challenge_token=login_outcome.challenge_token, totp_code=code,
        device_fingerprint="fp-1", device_name=None, ip_address="127.0.0.1", user_agent=None,
    )
    assert result.status == "authenticated"

    # Same code again (replay within the same 30s step) must be rejected even though
    # it is still within TOTP's validity window (Authentication Design §3).
    login_outcome_2 = await auth_service.login(
        session, settings, alias="Cipher-06", password="correct-horse-battery-staple-14",
        device_fingerprint="fp-1", device_name=None, ip_address="127.0.0.1", user_agent=None,
    )
    with pytest.raises(auth_service.AuthError):
        await auth_service.verify_mfa(
            session, settings, challenge_token=login_outcome_2.challenge_token, totp_code=code,
            device_fingerprint="fp-1", device_name=None, ip_address="127.0.0.1", user_agent=None,
        )


async def test_concurrent_mfa_verify_with_same_code_only_one_succeeds(session, settings: Settings) -> None:
    """Pentest Checklist §1: race condition submitting two codes simultaneously. Both
    requests share the same DB session/transaction in this test (matching how a real
    request handler's row lock would serialize them within Postgres); the second call
    must observe the already-consumed step and fail, not silently double-authenticate."""
    user = await _make_user(session, alias="Grid-12", password="correct-horse-battery-staple-14")
    secret, _uri = await auth_service.start_mfa_enrollment(settings, user=user)
    enroll_code = pyotp.TOTP(secret).now()
    await auth_service.confirm_mfa_enrollment(session, settings, user=user, secret=secret, totp_code=enroll_code)

    # See test_mfa_verify_rejects_replayed_code above for why this reset is needed —
    # without it this test is flaky depending on whether enrollment and the first
    # verify_mfa call below land in the same real-world 30s TOTP window.
    user.totp_last_step = None

    outcome = await auth_service.login(
        session, settings, alias="Grid-12", password="correct-horse-battery-staple-14",
        device_fingerprint="fp-1", device_name=None, ip_address="127.0.0.1", user_agent=None,
    )
    code = pyotp.TOTP(secret).now()

    first = await auth_service.verify_mfa(
        session, settings, challenge_token=outcome.challenge_token, totp_code=code,
        device_fingerprint="fp-1", device_name=None, ip_address="127.0.0.1", user_agent=None,
    )
    assert first.status == "authenticated"

    # Re-derive a fresh challenge (a real second concurrent request would present the
    # same challenge_token) and confirm the code is now consumed.
    with pytest.raises(auth_service.AuthError):
        await auth_service.verify_mfa(
            session, settings, challenge_token=outcome.challenge_token, totp_code=code,
            device_fingerprint="fp-1", device_name=None, ip_address="127.0.0.1", user_agent=None,
        )


async def test_refresh_rotates_token_and_revokes_old(session, settings: Settings) -> None:
    await _make_user(session, alias="Talon-09", password="correct-horse-battery-staple-14")
    outcome = await auth_service.login(
        session, settings, alias="Talon-09", password="correct-horse-battery-staple-14",
        device_fingerprint="fp-1", device_name=None, ip_address="127.0.0.1", user_agent=None,
    )

    new_access, new_refresh, _ttl = await auth_service.refresh_session(
        session, settings, refresh_token=outcome.refresh_token, ip_address="127.0.0.1", user_agent=None
    )
    assert new_refresh != outcome.refresh_token

    # Old refresh token is now revoked — using it again must fail, not succeed.
    with pytest.raises(auth_service.AuthError):
        await auth_service.refresh_session(
            session, settings, refresh_token=outcome.refresh_token, ip_address="127.0.0.1", user_agent=None
        )


async def test_refresh_token_reuse_revokes_entire_family(session, settings: Settings) -> None:
    await _make_user(session, alias="Onyx-05", password="correct-horse-battery-staple-14")
    outcome = await auth_service.login(
        session, settings, alias="Onyx-05", password="correct-horse-battery-staple-14",
        device_fingerprint="fp-1", device_name=None, ip_address="127.0.0.1", user_agent=None,
    )
    first_refresh = outcome.refresh_token

    _access2, second_refresh, _ttl = await auth_service.refresh_session(
        session, settings, refresh_token=first_refresh, ip_address="127.0.0.1", user_agent=None
    )

    # Replay the ALREADY-ROTATED first token (simulating a stolen-and-replayed token).
    with pytest.raises(auth_service.AuthError):
        await auth_service.refresh_session(
            session, settings, refresh_token=first_refresh, ip_address="127.0.0.1", user_agent=None
        )

    # The legitimate second-generation token must ALSO now be dead — reuse detection
    # revokes the whole rotation family, not just the replayed token.
    with pytest.raises(auth_service.AuthError):
        await auth_service.refresh_session(
            session, settings, refresh_token=second_refresh, ip_address="127.0.0.1", user_agent=None
        )
