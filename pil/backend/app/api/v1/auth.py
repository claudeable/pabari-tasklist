"""Authentication endpoints (API Specification doc "Auth" section, Authentication
Design doc §9 login sequence).

--- Portal map ---
This file is part of:  PIL / KETRACO portal  (pil-transmission-lines-app)
Master portal:         Pabari ERP            (pabari-erp.up.railway.app)

SSO flow (cross-portal login):
  1. User clicks PIL card in Pabari ERP hub
  2. Pabari issues a 60-second one-time token → POST /api/sso/token
  3. Pabari redirects user to /auth/sso?token=xxx (PIL frontend)
  4. PIL frontend calls POST /api/v1/auth/sso with the token
  5. PIL backend validates token via Pabari's POST /api/sso/validate
  6. PIL looks up user by pabari_email, issues its own access+refresh tokens
  7. PIL frontend stores access token in memory, redirects to /dashboard
"""

from __future__ import annotations

import secrets

import httpx
from fastapi import APIRouter, Cookie, Depends, Request, Response
from pydantic import BaseModel
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import Settings, get_settings
from app.core.deps import get_current_claims, get_session
from app.core.errors import AccountLockedHttpError, NotAuthenticatedError, RateLimitedError
from app.core.rate_limit import RateLimiter
from app.core.request_context import get_client_ip
from app.core.security.jwt import AccessTokenClaims, TokenError, verify_access_token, verify_purpose_token
from app.repositories import user_repository, device_repository
from app.schemas.auth import (
    LoginRequest,
    LoginResult,
    MfaEnrollConfirmRequest,
    MfaEnrollConfirmResponse,
    MfaEnrollResponse,
    MfaVerifyRequest,
    PasswordChangeRequest,
    TokenResponse,
)
from app.services import auth_service

router = APIRouter(prefix="/auth", tags=["auth"])

_REFRESH_COOKIE = "scv_refresh"
_CSRF_COOKIE = "scv_csrf"


def _set_session_cookies(response: Response, *, refresh_token: str, settings: Settings, secure: bool = True) -> None:
    response.set_cookie(
        _REFRESH_COOKIE,
        refresh_token,
        httponly=True,
        secure=secure,
        samesite=settings.cookie_samesite,
        path="/api/v1/auth",
        max_age=settings.jwt_refresh_ttl_seconds,
    )
    response.set_cookie(
        _CSRF_COOKIE,
        secrets.token_urlsafe(24),
        httponly=False,
        secure=secure,
        samesite=settings.cookie_samesite,
        path="/",
        max_age=settings.jwt_refresh_ttl_seconds,
    )


def _clear_session_cookies(response: Response) -> None:
    response.delete_cookie(_REFRESH_COOKIE, path="/api/v1/auth")
    response.delete_cookie(_CSRF_COOKIE, path="/")


async def _get_rate_limiter(request: Request) -> RateLimiter:
    return RateLimiter(request.app.state.redis)


@router.post("/login", response_model=LoginResult)
async def login(
    body: LoginRequest,
    request: Request,
    response: Response,
    session: AsyncSession = Depends(get_session),
    settings: Settings = Depends(get_settings),
    limiter: RateLimiter = Depends(_get_rate_limiter),
) -> LoginResult:
    ip = get_client_ip(request, settings)

    ip_check = await limiter.check(
        f"login:ip:{ip}", limit=settings.login_rate_limit_per_ip, window_seconds=settings.login_rate_limit_window_seconds
    )
    if not ip_check.allowed:
        raise RateLimitedError()

    account_check = await limiter.check(
        f"login:alias:{body.alias}",
        limit=settings.login_rate_limit_per_account,
        window_seconds=settings.login_rate_limit_window_seconds,
    )
    if not account_check.allowed:
        raise RateLimitedError()

    try:
        outcome = await auth_service.login(
            session,
            settings,
            alias=body.alias,
            password=body.password,
            device_fingerprint=body.device_fingerprint,
            device_name=body.device_name,
            ip_address=ip,
            user_agent=request.headers.get("User-Agent"),
        )
    except auth_service.AccountLockedError as exc:
        raise AccountLockedHttpError(f"Account locked until {exc.locked_until.isoformat()}") from exc
    except auth_service.AuthError as exc:
        raise NotAuthenticatedError("Invalid credentials") from exc

    if outcome.status == "authenticated":
        assert outcome.refresh_token is not None
        _set_session_cookies(response, refresh_token=outcome.refresh_token, settings=settings, secure=not settings.debug)

    return LoginResult(
        status=outcome.status,
        challenge_token=outcome.challenge_token,
        access_token=outcome.access_token,
        expires_in=outcome.expires_in,
    )


@router.post("/mfa/verify", response_model=LoginResult)
async def mfa_verify(
    body: MfaVerifyRequest,
    request: Request,
    response: Response,
    session: AsyncSession = Depends(get_session),
    settings: Settings = Depends(get_settings),
    limiter: RateLimiter = Depends(_get_rate_limiter),
) -> LoginResult:
    ip = get_client_ip(request, settings)

    challenge_check = await limiter.check(
        f"mfa:challenge:{body.challenge_token}",
        limit=settings.mfa_rate_limit_per_challenge,
        window_seconds=settings.mfa_rate_limit_window_seconds,
    )
    if not challenge_check.allowed:
        raise RateLimitedError()

    try:
        outcome = await auth_service.verify_mfa(
            session,
            settings,
            challenge_token=body.challenge_token,
            totp_code=body.totp_code,
            device_fingerprint=body.device_fingerprint,
            device_name=body.device_name,
            ip_address=ip,
            user_agent=request.headers.get("User-Agent"),
        )
    except auth_service.AuthError as exc:
        raise NotAuthenticatedError("Invalid code") from exc

    assert outcome.refresh_token is not None
    _set_session_cookies(response, refresh_token=outcome.refresh_token, settings=settings, secure=not settings.debug)

    return LoginResult(status=outcome.status, access_token=outcome.access_token, expires_in=outcome.expires_in)


@router.post("/refresh", response_model=TokenResponse)
async def refresh(
    request: Request,
    response: Response,
    scv_refresh: str | None = Cookie(default=None),
    session: AsyncSession = Depends(get_session),
    settings: Settings = Depends(get_settings),
    limiter: RateLimiter = Depends(_get_rate_limiter),
) -> TokenResponse:
    if scv_refresh is None:
        raise NotAuthenticatedError("Missing session")

    ip = get_client_ip(request, settings)
    check = await limiter.check(f"refresh:{scv_refresh[:16]}", limit=30, window_seconds=3600)
    if not check.allowed:
        raise RateLimitedError()

    try:
        access_token, new_refresh_token, ttl = await auth_service.refresh_session(
            session,
            settings,
            refresh_token=scv_refresh,
            ip_address=ip,
            user_agent=request.headers.get("User-Agent"),
        )
    except auth_service.AuthError as exc:
        _clear_session_cookies(response)
        raise NotAuthenticatedError("Invalid session") from exc

    _set_session_cookies(response, refresh_token=new_refresh_token, settings=settings, secure=not settings.debug)
    return TokenResponse(access_token=access_token, expires_in=ttl)


@router.post("/logout", status_code=204)
async def logout(
    response: Response,
    scv_refresh: str | None = Cookie(default=None),
    session: AsyncSession = Depends(get_session),
) -> None:
    if scv_refresh is not None:
        await auth_service.logout(session, refresh_token=scv_refresh)
    _clear_session_cookies(response)


@router.post("/logout-all", status_code=204)
async def logout_all(
    response: Response,
    claims: AccessTokenClaims = Depends(get_current_claims),
    session: AsyncSession = Depends(get_session),
) -> None:
    import uuid

    await auth_service.logout_all(session, user_id=uuid.UUID(claims.sub))
    _clear_session_cookies(response)


@router.post("/password/change", status_code=204)
async def change_password(
    body: PasswordChangeRequest,
    request: Request,
    session: AsyncSession = Depends(get_session),
    settings: Settings = Depends(get_settings),
) -> None:
    import uuid

    user_id = await _resolve_subject(
        request, settings, allowed_purposes={auth_service.PURPOSE_PASSWORD_CHANGE_REQUIRED}
    )
    user = await user_repository.get_by_id(session, uuid.UUID(user_id))
    if user is None:
        raise NotAuthenticatedError()

    try:
        await auth_service.change_password(
            session, user=user, current_password=body.current_password, new_password=body.new_password
        )
    except auth_service.AuthError as exc:
        from app.core.errors import AppError

        raise AppError(str(exc)) from exc


async def _resolve_subject(request: Request, settings: Settings, *, allowed_purposes: set[str]) -> str:
    """Resolves a user id from either a full access token, or a narrow pre-session
    purpose token (Threat Model §3.1) whose `typ` is in `allowed_purposes` — used for
    the forced-enrollment and forced-password-change flows that happen before a real
    session exists. A purpose token can never satisfy an endpoint outside its declared
    purpose set, so a password-change token cannot be replayed against, say, the MFA
    enrollment endpoint even though both are JWTs signed by the same key."""
    auth_header = request.headers.get("Authorization", "")
    if not auth_header.startswith("Bearer "):
        raise NotAuthenticatedError("Missing bearer token")
    token = auth_header.removeprefix("Bearer ").strip()

    public_key = settings.resolve_secret(settings.jwt_public_key, settings.jwt_public_key_path, "jwt_public_key")

    try:
        claims = verify_access_token(token, public_key_pem=public_key, issuer=settings.jwt_issuer)
        return claims.sub
    except TokenError:
        pass

    for purpose in allowed_purposes:
        try:
            return verify_purpose_token(
                token, expected_purpose=purpose, public_key_pem=public_key, issuer=settings.jwt_issuer
            )
        except TokenError:
            continue

    raise NotAuthenticatedError("Invalid or expired token")


async def _resolve_enrollment_user_id(request: Request, settings: Settings) -> str:
    return await _resolve_subject(
        request, settings, allowed_purposes={auth_service.PURPOSE_MFA_ENROLLMENT_REQUIRED}
    )


@router.post("/mfa/enroll", response_model=MfaEnrollResponse)
async def mfa_enroll(
    request: Request,
    session: AsyncSession = Depends(get_session),
    settings: Settings = Depends(get_settings),
) -> MfaEnrollResponse:
    import uuid

    user_id = await _resolve_enrollment_user_id(request, settings)
    user = await user_repository.get_by_id(session, uuid.UUID(user_id))
    if user is None:
        raise NotAuthenticatedError()

    secret, uri = await auth_service.start_mfa_enrollment(settings, user=user)
    # NOTE: the secret must be relayed to the client for THIS single enrollment
    # attempt only, and confirmed via /mfa/enroll/confirm — the secret is not
    # persisted until confirmation succeeds (see auth_service.start_mfa_enrollment).
    return MfaEnrollResponse(provisioning_uri=uri, secret=secret)


@router.post("/mfa/enroll/confirm", response_model=MfaEnrollConfirmResponse)
async def mfa_enroll_confirm(
    body: MfaEnrollConfirmRequest,
    request: Request,
    session: AsyncSession = Depends(get_session),
    settings: Settings = Depends(get_settings),
) -> MfaEnrollConfirmResponse:
    import uuid

    user_id = await _resolve_enrollment_user_id(request, settings)
    user = await user_repository.get_by_id(session, uuid.UUID(user_id))
    if user is None:
        raise NotAuthenticatedError()

    try:
        backup_codes = await auth_service.confirm_mfa_enrollment(
            session, settings, user=user, secret=body.secret, totp_code=body.totp_code
        )
    except auth_service.AuthError as exc:
        raise NotAuthenticatedError("Invalid code") from exc

    return MfaEnrollConfirmResponse(backup_codes=backup_codes)


# ── Pabari ERP SSO ────────────────────────────────────────────────────────────
# Portal: PIL / KETRACO
# Called by the PIL frontend /auth/sso page after receiving a Pabari SSO token.
# Validates the token with Pabari ERP (server-to-server), looks up the PIL user
# by pabari_email, and issues a normal PIL session.
# ─────────────────────────────────────────────────────────────────────────────

class SsoRequest(BaseModel):
    pabari_token: str


@router.post("/sso", response_model=LoginResult)
async def sso_login(
    body: SsoRequest,
    request: Request,
    response: Response,
    session: AsyncSession = Depends(get_session),
    settings: Settings = Depends(get_settings),
) -> LoginResult:
    if not settings.pabari_url:
        raise NotAuthenticatedError("SSO is not configured on this deployment")

    # 1. Validate the Pabari one-time token (server → server)
    try:
        async with httpx.AsyncClient(timeout=10) as client:
            r = await client.post(
                f"{settings.pabari_url.rstrip('/')}/api/sso/validate",
                json={"token": body.pabari_token},
                headers={"Content-Type": "application/json"},
            )
    except httpx.RequestError as exc:
        raise NotAuthenticatedError("Could not reach Pabari ERP for SSO validation") from exc

    if r.status_code != 200:
        raise NotAuthenticatedError("Invalid or expired SSO token")

    pabari_data = r.json()
    pabari_email: str = pabari_data.get("email", "")
    if not pabari_email:
        raise NotAuthenticatedError("SSO response missing user identity")

    # 2. Find the PIL user linked to this Pabari email
    user = await user_repository.get_by_pabari_email(session, pabari_email)
    if user is None:
        raise NotAuthenticatedError(
            f"No PIL account is linked to {pabari_email}. "
            "Ask a PIL admin to set your pabari_email in your profile."
        )

    ip = get_client_ip(request, settings)
    # Use a stable synthetic fingerprint for SSO sessions so they get
    # their own device row rather than colliding with real browser sessions.
    sso_fingerprint = f"sso:pabari:{user.id}"
    device = await device_repository.get_or_create(
        session, user.id, sso_fingerprint, "Pabari ERP SSO"
    )

    # 3. Issue a normal PIL session (access + refresh tokens)
    access_token, refresh_token, ttl = await auth_service._issue_session(
        session,
        settings,
        user=user,
        device_id=device.id,
        ip_address=ip,
        user_agent=request.headers.get("User-Agent"),
        mfa_verified=False,  # SSO bypasses MFA; acceptable for this deployment
    )

    _set_session_cookies(response, refresh_token=refresh_token, settings=settings, secure=not settings.debug)

    return LoginResult(
        status="authenticated",
        challenge_token=None,
        access_token=access_token,
        expires_in=ttl,
    )
