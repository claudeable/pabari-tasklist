from datetime import datetime, timedelta, timezone
from typing import Optional

import secrets
import uuid

import httpx
from fastapi import APIRouter, Depends, HTTPException, Request, Response, status
from passlib.context import CryptContext
from pydantic import BaseModel
from sqlalchemy.orm import Session

from app.core.config import settings
from app.core.deps import get_current_user, get_db
from app.core.security import create_access_token, verify_password
from app.models.login_attempt import LoginAttempt
from app.models.organization import Organization
from app.models.role import Role
from app.models.user import User
from app.schemas.token import LoginRequest, Token
from app.schemas.user import UserReadWithRole

_pwd_context = CryptContext(schemes=["bcrypt"])

router = APIRouter()


def _client_ip(request: Request) -> Optional[str]:
    forwarded = request.headers.get("x-forwarded-for")
    if forwarded:
        return forwarded.split(",")[0].strip()
    return request.client.host if request.client else None


def _check_rate_limit(db: Session, email: str) -> None:
    window_start = datetime.now(timezone.utc) - timedelta(
        minutes=settings.LOGIN_RATE_LIMIT_WINDOW_MINUTES
    )
    recent_failures = (
        db.query(LoginAttempt)
        .filter(
            LoginAttempt.email == email,
            LoginAttempt.success.is_(False),
            LoginAttempt.created_at >= window_start,
        )
        .count()
    )
    if recent_failures >= settings.LOGIN_RATE_LIMIT_ATTEMPTS:
        raise HTTPException(
            status_code=status.HTTP_429_TOO_MANY_REQUESTS,
            detail="Too many failed login attempts. Please try again later.",
        )


def _record_attempt(db: Session, email: str, ip: Optional[str], success: bool) -> None:
    db.add(LoginAttempt(email=email, success=success, ip_address=ip))
    db.commit()


def _authenticate(db: Session, email: str, password: str, ip: Optional[str]) -> User:
    _check_rate_limit(db, email)

    user = db.query(User).filter(User.email == email).first()
    if not user or not verify_password(password, user.hashed_password):
        _record_attempt(db, email, ip, success=False)
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Incorrect email or password")
    if not user.is_active:
        _record_attempt(db, email, ip, success=False)
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Inactive user")

    _record_attempt(db, email, ip, success=True)
    return user


@router.post("/login", response_model=Token)
async def login(request: Request, response: Response, db: Session = Depends(get_db)) -> Token:
    """Accepts either an OAuth2 password form (username/password) or a JSON body
    {"email": ..., "password": ...}, so both the FastAPI docs 'Authorize' button
    and a plain JSON frontend login form work against the same endpoint.

    Sets the JWT as an httpOnly cookie for browser sessions (so it's never
    readable by client-side JS) and also returns it in the JSON body for
    API/script clients that authenticate via a Bearer header instead.
    """
    content_type = request.headers.get("content-type", "")

    email: Optional[str] = None
    password: Optional[str] = None

    if "application/json" in content_type:
        body = await request.json()
        login_data = LoginRequest(**body)
        email = login_data.email
        password = login_data.password
    else:
        form = await request.form()
        email = form.get("username") or form.get("email")
        password = form.get("password")

    if not email or not password:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY, detail="email and password are required"
        )

    user = _authenticate(db, email, password, _client_ip(request))
    token = create_access_token(subject=str(user.id))

    response.set_cookie(
        key=settings.AUTH_COOKIE_NAME,
        value=token,
        httponly=True,
        secure=settings.COOKIE_SECURE,
        samesite=settings.COOKIE_SAMESITE,
        max_age=settings.ACCESS_TOKEN_EXPIRE_MINUTES * 60,
        path="/",
    )

    return Token(access_token=token)


@router.post("/logout")
def logout(response: Response) -> dict:
    response.delete_cookie(
        key=settings.AUTH_COOKIE_NAME,
        path="/",
        secure=settings.COOKIE_SECURE,
        samesite=settings.COOKIE_SAMESITE,
    )
    return {"status": "ok"}


class SsoRequest(BaseModel):
    pabari_token: str


@router.post("/sso", response_model=Token)
async def sso_login(body: SsoRequest, response: Response, db: Session = Depends(get_db)) -> Token:
    """Validate a Pabari SSO token and issue a Smart Ops session."""
    if not settings.PABARI_URL:
        raise HTTPException(status_code=503, detail="SSO not configured")

    # Server-to-server: validate the one-time token with Pabari ERP
    try:
        async with httpx.AsyncClient(timeout=10.0) as client:
            r = await client.post(
                f"{settings.PABARI_URL}/api/sso/validate",
                json={"token": body.pabari_token},
            )
    except httpx.RequestError:
        raise HTTPException(status_code=502, detail="Could not reach Pabari to validate token")

    if r.status_code != 200:
        raise HTTPException(status_code=401, detail="Invalid or expired SSO token")

    data = r.json()
    pabari_email: str = data.get("email", "")

    user = db.query(User).filter(User.email == pabari_email).first()
    if not user:
        # Auto-provision: create a Smart Ops account on first SSO login
        pabari_name: str = data.get("name", pabari_email.split("@")[0])
        org = db.query(Organization).first()
        role = db.query(Role).filter(Role.name == "member").first() or db.query(Role).first()
        if not org or not role:
            raise HTTPException(status_code=500, detail="Smart Ops not initialised — no organisation or role found")
        user = User(
            id=uuid.uuid4(),
            organization_id=org.id,
            full_name=pabari_name,
            email=pabari_email,
            hashed_password=_pwd_context.hash(secrets.token_urlsafe(32)),
            role_id=role.id,
            is_active=True,
        )
        db.add(user)
        db.commit()
        db.refresh(user)
    if not user.is_active:
        raise HTTPException(status_code=403, detail="Inactive user")

    token = create_access_token(subject=str(user.id))

    response.set_cookie(
        key=settings.AUTH_COOKIE_NAME,
        value=token,
        httponly=True,
        secure=settings.COOKIE_SECURE,
        samesite=settings.COOKIE_SAMESITE,
        max_age=settings.ACCESS_TOKEN_EXPIRE_MINUTES * 60,
        path="/",
    )

    return Token(access_token=token)


@router.get("/me", response_model=UserReadWithRole)
def read_me(current_user: User = Depends(get_current_user)) -> User:
    return current_user
