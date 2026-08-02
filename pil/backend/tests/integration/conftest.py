import os
import uuid

import pytest
from cryptography.hazmat.primitives import serialization
from cryptography.hazmat.primitives.asymmetric.ed25519 import Ed25519PrivateKey
from sqlalchemy.ext.asyncio import async_sessionmaker

from app.core.config import Settings
from app.core.db import create_engine
from app.domain.models.base import Base


async def make_user(session, alias: str | None = None):
    """Creates and flushes a real `users` row. MUST be used anywhere a test needs a
    value for a column that's actually a foreign key to users.id (created_by,
    author_id, assignee_id, uploaded_by, recipient_id, security_events.user_id via an
    admin_service *_by actor, etc.) — a bare uuid.uuid4() there passes type-checking
    but violates the FK constraint against a real Postgres instance at flush/commit
    time. Only use a bare uuid.uuid4() for ids that are genuinely never persisted as a
    foreign key (e.g. a deliberately-nonexistent-resource-id test case)."""
    from app.core.security.passwords import hash_password
    from app.domain.models.user import User

    user = User(alias=alias or f"Test-{uuid.uuid4().hex[:10]}", password_hash=hash_password("x" * 20))
    session.add(user)
    await session.flush()
    return user


def _generate_keypair() -> tuple[str, str]:
    private_key = Ed25519PrivateKey.generate()
    private_pem = private_key.private_bytes(
        encoding=serialization.Encoding.PEM,
        format=serialization.PrivateFormat.PKCS8,
        encryption_algorithm=serialization.NoEncryption(),
    ).decode()
    public_pem = (
        private_key.public_key()
        .public_bytes(
            encoding=serialization.Encoding.PEM, format=serialization.PublicFormat.SubjectPublicKeyInfo
        )
        .decode()
    )
    return private_pem, public_pem


@pytest.fixture
def settings() -> Settings:
    private_pem, public_pem = _generate_keypair()
    return Settings(
        _env_file=None,  # tests must be hermetic — never silently pick up a developer's
        # local backend/.env (e.g. its JWT_PRIVATE_KEY_PATH would otherwise win over
        # the fresh in-memory keypair generated below for fields this fixture doesn't
        # explicitly set, since pydantic-settings fills unset fields from .env by
        # default). Caught by a real signature-verification failure once a .env file
        # actually existed locally — exactly the kind of cross-test-run contamination
        # that only shows up by running tests against real local state, not in CI
        # where no such file exists.
        database_url=os.environ["DATABASE_URL"],
        redis_url=os.environ.get("REDIS_URL", "redis://localhost:6379/0"),
        jwt_private_key=private_pem,
        jwt_public_key=public_pem,
        jwt_private_key_path=None,
        jwt_public_key_path=None,
        root_secret="integration-test-root-secret",
        root_secret_path=None,
        jwt_access_ttl_seconds=900,
        jwt_refresh_ttl_seconds=604800,
        mfa_challenge_ttl_seconds=120,
        lockout_schedule_minutes=[1, 5, 30, 1440],
    )


@pytest.fixture
async def session(settings: Settings):
    engine = create_engine(settings)
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)

        # Truncate everything before each test. Tests commit real data (some, like the
        # RLS tests, MUST commit so a second connection under app_role can see it —
        # that rules out the usual "wrap the whole test in a rolled-back transaction"
        # isolation trick). Without this, data a earlier test committed (e.g. an alias
        # like "Falcon-01" reused across test_auth_flows.py and test_rbac_service.py)
        # collides with a later test in the same run via a UNIQUE constraint — caught
        # by actually running the full suite in one pass against a real database, not
        # by any single test running in isolation.
        from sqlalchemy import text

        table_names = [t.name for t in reversed(Base.metadata.sorted_tables)]
        if table_names:
            await conn.execute(text(f"TRUNCATE TABLE {', '.join(table_names)} RESTART IDENTITY CASCADE"))

    factory = async_sessionmaker(engine, expire_on_commit=False)
    async with factory() as s:
        yield s

    await engine.dispose()


@pytest.fixture
async def app_role_settings(settings: Settings, session) -> Settings:
    """RLS policies use FORCE ROW LEVEL SECURITY specifically so they still apply to
    the table owner (Database Design doc §4, migration 0001/0003 comments) — but a
    Postgres *superuser* bypasses RLS unconditionally regardless of FORCE, and the
    default `postgres` test image's POSTGRES_USER connects as exactly that. Testing
    RLS through the superuser connection would give false confidence (the policy could
    be completely broken and every assertion would still pass). This fixture connects
    through `app_role` instead — the actual least-privileged role the deployed app
    itself uses (Deployment & Hardening Guide §4) — so the RLS test exercises the real
    enforcement boundary, not a stand-in for it.
    """
    from sqlalchemy import text

    await session.execute(text("ALTER ROLE app_role WITH PASSWORD 'test_app_role_password' LOGIN"))
    await session.commit()

    import re

    app_role_url = re.sub(r"://[^:]+:[^@]+@", "://app_role:test_app_role_password@", settings.database_url)
    return settings.model_copy(update={"database_url": app_role_url})


@pytest.fixture
async def app_role_session(app_role_settings: Settings):
    engine = create_engine(app_role_settings)
    factory = async_sessionmaker(engine, expire_on_commit=False)
    async with factory() as s:
        yield s
    await engine.dispose()
