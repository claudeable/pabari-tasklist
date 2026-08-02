"""Async SQLAlchemy engine/session setup, with per-request tenant context binding.

Tenant isolation (Threat Model §3.2, Database Design §4) is enforced twice:
1. Repository-layer filters explicitly include organization_id in every query.
2. PostgreSQL RLS policies independently enforce the same boundary using
   `app.current_org_id` / `app.current_user_id`, set via `SET LOCAL` at the start of
   each transaction from the verified JWT claims — never from client-supplied input.
   A bug in (1) alone is therefore not sufficient to leak cross-tenant data.
"""

from __future__ import annotations

from collections.abc import AsyncIterator
from contextlib import asynccontextmanager

from sqlalchemy.ext.asyncio import AsyncEngine, AsyncSession, async_sessionmaker, create_async_engine

from app.core.config import Settings


def create_engine(settings: Settings) -> AsyncEngine:
    return create_async_engine(
        settings.database_url,
        pool_pre_ping=True,
        pool_size=10,
        max_overflow=10,
        echo=settings.debug,
    )


def make_session_factory(engine: AsyncEngine) -> async_sessionmaker[AsyncSession]:
    return async_sessionmaker(engine, expire_on_commit=False, autoflush=False)


@asynccontextmanager
async def tenant_scoped_session(
    session_factory: async_sessionmaker[AsyncSession],
    *,
    user_id: str | None,
    organization_id: str | None,
) -> AsyncIterator[AsyncSession]:
    """Yields a session with RLS context vars set for the duration of the transaction.

    Uses SET LOCAL (not SET) so the context never leaks to a pooled connection reused by
    a different request/tenant afterward — it is automatically reset at transaction end.
    """
    async with session_factory() as session:
        async with session.begin():
            if user_id:
                await session.execute(
                    _set_local("app.current_user_id", user_id)
                )
            if organization_id:
                await session.execute(
                    _set_local("app.current_org_id", organization_id)
                )
            yield session


def _set_local(setting_name: str, value: str):
    from sqlalchemy import text

    # Parameterized via bound value, not string interpolation — set_config's second
    # argument accepts a normal query parameter.
    return text("SELECT set_config(:name, :value, true)").bindparams(name=setting_name, value=value)
