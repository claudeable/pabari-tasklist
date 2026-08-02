from __future__ import annotations

from collections.abc import AsyncIterator
from contextlib import asynccontextmanager

import redis.asyncio as redis
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.api.v1.router import api_router
from app.core.config import get_settings
from app.core.db import create_engine, make_session_factory
from app.core.errors import register_error_handlers
from app.core.logging import configure_logging
from app.core.security.virus_scan import ClamdScanner, StubScanner
from app.core.storage import FileStorage
from app.middleware.csrf import CSRFMiddleware
from app.middleware.request_logging import RequestLoggingMiddleware
from app.middleware.security_headers import SecurityHeadersMiddleware


@asynccontextmanager
async def lifespan(app: FastAPI) -> AsyncIterator[None]:
    settings = get_settings()
    engine = create_engine(settings)
    app.state.engine = engine
    app.state.session_factory = make_session_factory(engine)
    app.state.redis = redis.from_url(settings.redis_url, decode_responses=True)
    app.state.storage = FileStorage(settings.storage_path)

    # StubScanner refuses to instantiate outside development/test (see its
    # docstring) — a production deployment MUST set virus_scan_enabled with clamd
    # reachable, or every upload stays scan_status="error" and undownloadable rather
    # than silently skipping the scan (Deployment & Hardening Guide §6).
    if settings.virus_scan_enabled:
        app.state.scanner = ClamdScanner(settings.clamd_host, settings.clamd_port)
    else:
        app.state.scanner = StubScanner(environment=settings.environment)

    yield

    await app.state.redis.aclose()
    await engine.dispose()


def create_app() -> FastAPI:
    settings = get_settings()
    configure_logging(debug=settings.debug)

    app = FastAPI(
        title="Secure Collaboration Vault API",
        version="0.1.0",
        docs_url="/docs" if settings.expose_openapi_docs and not settings.is_production else None,
        redoc_url=None,
        openapi_url="/api/v1/openapi.json" if settings.expose_openapi_docs and not settings.is_production else None,
        lifespan=lifespan,
    )

    register_error_handlers(app)

    # Order matters: outermost (added last) runs first. Security headers should wrap
    # every response including error responses from inner middleware.
    app.add_middleware(
        CORSMiddleware,
        allow_origins=settings.allowed_origins,
        allow_credentials=True,
        allow_methods=["GET", "POST", "PATCH", "PUT", "DELETE"],
        allow_headers=["Authorization", "Content-Type", "X-CSRF-Token"],
    )
    app.add_middleware(CSRFMiddleware)
    app.add_middleware(RequestLoggingMiddleware)
    app.add_middleware(SecurityHeadersMiddleware)

    app.include_router(api_router)

    return app


app = create_app()
