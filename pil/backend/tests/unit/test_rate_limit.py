import pytest
from fakeredis.aioredis import FakeRedis

from app.core.rate_limit import RateLimiter


@pytest.fixture
async def limiter():
    redis_client = FakeRedis()
    yield RateLimiter(redis_client)
    await redis_client.aclose()


async def test_allows_up_to_limit(limiter: RateLimiter) -> None:
    for _ in range(5):
        result = await limiter.check("login:ip:1.2.3.4", limit=5, window_seconds=300)
        assert result.allowed is True


async def test_blocks_after_limit_exceeded(limiter: RateLimiter) -> None:
    for _ in range(5):
        await limiter.check("login:ip:1.2.3.4", limit=5, window_seconds=300)

    result = await limiter.check("login:ip:1.2.3.4", limit=5, window_seconds=300)
    assert result.allowed is False
    assert result.remaining == 0


async def test_independent_keys_have_independent_counters(limiter: RateLimiter) -> None:
    for _ in range(5):
        await limiter.check("login:ip:1.2.3.4", limit=5, window_seconds=300)

    result = await limiter.check("login:ip:9.9.9.9", limit=5, window_seconds=300)
    assert result.allowed is True
