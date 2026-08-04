"""HTTP security headers (Security Architecture doc §3). Belt-and-suspenders alongside
the reverse proxy — the app sets these itself so they hold even if the proxy config
drifts, and so `Cache-Control: no-store` can be applied per-response based on route."""

from __future__ import annotations

import secrets

from starlette.middleware.base import BaseHTTPMiddleware, RequestResponseEndpoint
from starlette.requests import Request
from starlette.responses import Response


class SecurityHeadersMiddleware(BaseHTTPMiddleware):
    async def dispatch(self, request: Request, call_next: RequestResponseEndpoint) -> Response:
        nonce = secrets.token_urlsafe(16)
        request.state.csp_nonce = nonce
        response = await call_next(request)

        response.headers["Strict-Transport-Security"] = "max-age=31536000; includeSubDomains; preload"
        response.headers["Content-Security-Policy"] = (
            f"default-src 'self'; script-src 'self' 'nonce-{nonce}'; "
            f"style-src 'self' 'nonce-{nonce}'; img-src 'self' data:; "
            "connect-src 'self'; frame-ancestors 'none'; base-uri 'self'; "
            "form-action 'self'; object-src 'none'"
        )
        response.headers["X-Content-Type-Options"] = "nosniff"
        response.headers["X-Frame-Options"] = "DENY"
        response.headers["Referrer-Policy"] = "no-referrer"
        response.headers["Permissions-Policy"] = (
            "geolocation=(), camera=(), microphone=(), payment=()"
        )
        response.headers["Cross-Origin-Opener-Policy"] = "same-origin"
        response.headers["Cross-Origin-Resource-Policy"] = "cross-origin"
        response.headers["Cache-Control"] = "no-store"
        # Starlette's MutableHeaders has no .pop() (unlike a plain dict) — this raised
        # AttributeError on every single response, meaning this middleware crashed the
        # entire request in practice and every response fell through to the generic
        # 500 handler. Only caught by actually sending a real request through it.
        if "Server" in response.headers:
            del response.headers["Server"]
        return response
