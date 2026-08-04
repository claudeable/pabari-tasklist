"""Double-submit CSRF protection (Security Architecture doc §4).

CSRF is a *cookie-authentication* problem: a malicious page can make the browser send
a request with the victim's cookies attached, but it cannot make the browser attach an
`Authorization: Bearer` header the page's own JS never had access to. Since our access
tokens are never stored in a cookie, any request that already carries a Bearer header
is not CSRF-exploitable — verification of *whether that token is actually valid*
happens downstream in the route's own auth dependency, so a forged/garbage Bearer
header buys an attacker nothing here. This matters concretely for the forced
MFA-enrollment and forced-password-change flows: those use a single-purpose Bearer
token issued before any session (and therefore before any CSRF cookie) exists, so a
cookie-presence rule alone would incorrectly lock legitimate users out of completing
login. Only requests relying on cookies for authentication — refresh and logout — are
actually enforced against.
"""

from __future__ import annotations

import hmac

from starlette.middleware.base import BaseHTTPMiddleware, RequestResponseEndpoint
from starlette.requests import Request
from starlette.responses import JSONResponse, Response

_SAFE_METHODS = {"GET", "HEAD", "OPTIONS"}
_EXEMPT_PATHS = {"/api/v1/auth/login", "/api/v1/auth/mfa/verify", "/api/v1/auth/sso"}  # pre-session, no cookie yet


class CSRFMiddleware(BaseHTTPMiddleware):
    async def dispatch(self, request: Request, call_next: RequestResponseEndpoint) -> Response:
        has_bearer = request.headers.get("Authorization", "").startswith("Bearer ")
        if request.method in _SAFE_METHODS or request.url.path in _EXEMPT_PATHS or has_bearer:
            return await call_next(request)

        cookie_token = request.cookies.get("scv_csrf")
        header_token = request.headers.get("X-CSRF-Token")

        if not cookie_token or not header_token or not hmac.compare_digest(cookie_token, header_token):
            return JSONResponse(
                status_code=403,
                media_type="application/problem+json",
                content={
                    "type": "about:blank",
                    "title": "CSRF token missing or invalid",
                    "status": 403,
                    "instance": str(request.url.path),
                },
            )
        return await call_next(request)
