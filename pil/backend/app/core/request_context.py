"""Client IP resolution. Deliberately conservative: X-Forwarded-For is only trusted
when `trust_proxy_headers` is explicitly enabled for a deployment that terminates TLS
at a proxy under the same operator's control — otherwise it's a trivial rate-limit and
lockout bypass (any client can send an arbitrary X-Forwarded-For header)."""

from __future__ import annotations

from starlette.requests import Request

from app.core.config import Settings


def get_client_ip(request: Request, settings: Settings) -> str:
    if settings.trust_proxy_headers:
        forwarded = request.headers.get("X-Forwarded-For")
        if forwarded:
            # Leftmost entry is the original client per convention; only meaningful
            # when every hop up to the proxy is trusted infrastructure.
            return forwarded.split(",")[0].strip()
    return request.client.host if request.client else "unknown"
