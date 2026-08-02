import os

# Ensure required settings resolve even when tests import app.core.config before any
# fixture runs (module-level get_settings() calls in app.main).
os.environ.setdefault("DATABASE_URL", "postgresql+asyncpg://scv_test:scv_test_password@localhost:5432/scv_test")
os.environ.setdefault("REDIS_URL", "redis://localhost:6379/0")
os.environ.setdefault("ROOT_SECRET", "test-only-root-secret-not-for-production-use")
os.environ.setdefault("ENVIRONMENT", "test")

import pytest


@pytest.fixture
def anyio_backend() -> str:
    return "asyncio"
