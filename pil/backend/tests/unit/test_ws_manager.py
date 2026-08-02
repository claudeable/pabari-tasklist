"""Pentest Checklist §7 WebSocket: ticket must be single-use and short-lived."""

import uuid

import pytest
from fakeredis.aioredis import FakeRedis

from app.core.ws_manager import issue_ticket, redeem_ticket


@pytest.fixture
async def redis_client():
    # decode_responses=True matches how the real client is constructed in
    # app/main.py — without it, this double returns bytes where production always
    # returns str, and ws_manager.py's raw.split(":", 1) would only work by
    # accident in a mismatched test double, not for a real reason.
    client = FakeRedis(decode_responses=True)
    yield client
    await client.aclose()


async def test_ticket_redeems_to_correct_user_and_channel(redis_client) -> None:
    user_id = uuid.uuid4()
    channel_id = uuid.uuid4()
    ticket = await issue_ticket(redis_client, user_id=user_id, channel_id=channel_id)

    redeemed = await redeem_ticket(redis_client, ticket=ticket)
    assert redeemed == (user_id, channel_id)


async def test_ticket_is_single_use(redis_client) -> None:
    user_id = uuid.uuid4()
    channel_id = uuid.uuid4()
    ticket = await issue_ticket(redis_client, user_id=user_id, channel_id=channel_id)

    first = await redeem_ticket(redis_client, ticket=ticket)
    assert first is not None

    second = await redeem_ticket(redis_client, ticket=ticket)
    assert second is None


async def test_unknown_ticket_rejected(redis_client) -> None:
    result = await redeem_ticket(redis_client, ticket="not-a-real-ticket")
    assert result is None


async def test_tickets_are_high_entropy_and_unique(redis_client) -> None:
    user_id = uuid.uuid4()
    channel_id = uuid.uuid4()
    tickets = {await issue_ticket(redis_client, user_id=user_id, channel_id=channel_id) for _ in range(20)}
    assert len(tickets) == 20
    assert all(len(t) >= 32 for t in tickets)
