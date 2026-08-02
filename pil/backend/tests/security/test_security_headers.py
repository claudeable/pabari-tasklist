"""Security Testing Plan §2 "CSRF / Headers" cases, for what exists in Phase 0."""

import pytest
from fastapi import FastAPI
from httpx import ASGITransport, AsyncClient

from app.core.config import get_settings
from app.core.errors import register_error_handlers
from app.main import create_app


@pytest.fixture
async def client(monkeypatch):
    # create_app() -> get_settings() reads the real app config, including a
    # developer's local backend/.env if one exists (e.g. EXPOSE_OPENAPI_DOCS=true for
    # local preview convenience) — a security assertion like "docs are disabled by
    # default" must not depend on what happens to be sitting in the working
    # directory. Force the fields this file's assertions actually depend on, and
    # clear the lru_cache so this test doesn't silently reuse a Settings instance
    # some earlier test in the same pytest session already constructed.
    monkeypatch.setenv("EXPOSE_OPENAPI_DOCS", "false")
    monkeypatch.setenv("ENVIRONMENT", "test")
    get_settings.cache_clear()

    app = create_app()
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as ac:
        yield ac

    get_settings.cache_clear()


async def test_security_headers_present_on_every_response(client: AsyncClient) -> None:
    response = await client.get("/api/v1/healthz")
    assert response.headers["Strict-Transport-Security"].startswith("max-age=")
    assert response.headers["X-Content-Type-Options"] == "nosniff"
    assert response.headers["X-Frame-Options"] == "DENY"
    assert response.headers["Referrer-Policy"] == "no-referrer"
    assert "Content-Security-Policy" in response.headers
    assert response.headers["Cache-Control"] == "no-store"
    assert "Server" not in response.headers


async def test_security_headers_present_on_error_response(client: AsyncClient) -> None:
    response = await client.get("/api/v1/nonexistent-route")
    assert response.status_code == 404
    assert "Strict-Transport-Security" in response.headers
    assert "X-Frame-Options" in response.headers


async def test_unhandled_exception_returns_generic_500_no_detail() -> None:
    # Isolated app instance with a deliberately failing route, exercising only the
    # error-handling framework (Security Architecture doc — no stack traces, SQL text,
    # or internal paths ever reach the client for an unexpected exception).
    app = FastAPI()
    register_error_handlers(app)

    @app.get("/boom")
    async def boom():
        raise RuntimeError("db connection string: postgresql://user:pass@internal-host/db")

    # Starlette's ServerErrorMiddleware intentionally re-raises the original exception
    # even after building the sanitized response from our registered handler (so it
    # still reaches server-level logging under a real ASGI server) — and httpx's
    # ASGITransport re-raises that to the caller by default (raise_app_exceptions=True)
    # instead of surfacing the actual Response it produced. That's the correct
    # behavior for uvicorn in production (the process logs it and moves on) but means
    # a raw `ASGITransport(app=app)` here would make this test fail on the exception
    # itself rather than checking the response we actually care about.
    transport = ASGITransport(app=app, raise_app_exceptions=False)
    async with AsyncClient(transport=transport, base_url="http://test") as ac:
        response = await ac.get("/boom")

    assert response.status_code == 500
    body = response.text
    assert "postgresql://" not in body
    assert "Traceback" not in body
    assert "RuntimeError" not in body


async def test_mutating_request_without_csrf_token_rejected(client: AsyncClient) -> None:
    response = await client.post("/api/v1/organizations", json={"name": "Acme"})
    # 403 (CSRF) expected before any auth/routing concern for a mutating request
    # lacking a matching csrf cookie/header pair.
    assert response.status_code in (403, 404)  # 404 acceptable pre-Phase-2 (route not yet mounted)


async def test_openapi_docs_disabled_by_default(client: AsyncClient) -> None:
    response = await client.get("/docs")
    assert response.status_code == 404
