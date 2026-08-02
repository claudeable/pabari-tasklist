"""Online/offline presence, tracked via a Redis connection-count hash.

A plain SADD/SREM online-set would be wrong the moment a user has more than one
WS connection open (two tabs, or a channel switch that briefly overlaps old and
new sockets) — closing one would incorrectly mark them offline while the other
is still live. A per-user counter (incremented on connect, decremented on
disconnect) makes "online" mean "at least one active connection," which is what
it should mean.
"""

from __future__ import annotations

import uuid

import redis.asyncio as redis

_PRESENCE_KEY = "presence:connection_counts"


async def mark_connected(redis_client: redis.Redis, user_id: uuid.UUID) -> None:
    await redis_client.hincrby(_PRESENCE_KEY, str(user_id), 1)


async def mark_disconnected(redis_client: redis.Redis, user_id: uuid.UUID) -> None:
    new_count = await redis_client.hincrby(_PRESENCE_KEY, str(user_id), -1)
    if new_count <= 0:
        # Clean up rather than let the hash accumulate a zero/negative entry per
        # user forever — a disconnect racing a fresh connect could otherwise leave
        # a stale 0 sitting around indefinitely.
        await redis_client.hdel(_PRESENCE_KEY, str(user_id))


async def get_online_user_ids(redis_client: redis.Redis, user_ids: list[uuid.UUID]) -> set[uuid.UUID]:
    if not user_ids:
        return set()
    keys = [str(uid) for uid in user_ids]
    counts = await redis_client.hmget(_PRESENCE_KEY, keys)
    return {uid for uid, count in zip(user_ids, counts, strict=True) if count is not None and int(count) > 0}
