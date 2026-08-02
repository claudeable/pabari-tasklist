"""Redis-backed sliding-window rate limiting (Security Architecture doc §7).

Uses a simple fixed-window-counter approximation (INCR + EXPIRE) rather than a true
sliding log, trading a small amount of precision at window boundaries for O(1) memory
and no per-request list growth — acceptable for abuse throttling, not a billing system.
"""

from __future__ import annotations

from dataclasses import dataclass

import redis.asyncio as redis


@dataclass(frozen=True)
class RateLimitResult:
    allowed: bool
    remaining: int
    retry_after_seconds: int


class RateLimiter:
    def __init__(self, redis_client: redis.Redis) -> None:
        self._redis = redis_client

    async def check(self, key: str, *, limit: int, window_seconds: int) -> RateLimitResult:
        full_key = f"ratelimit:{key}:{window_seconds}"
        count = await self._redis.incr(full_key)
        if count == 1:
            await self._redis.expire(full_key, window_seconds)
        ttl = await self._redis.ttl(full_key)
        retry_after = ttl if ttl > 0 else window_seconds
        if count > limit:
            return RateLimitResult(allowed=False, remaining=0, retry_after_seconds=retry_after)
        return RateLimitResult(allowed=True, remaining=limit - count, retry_after_seconds=retry_after)
