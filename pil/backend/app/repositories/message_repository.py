from __future__ import annotations

import uuid
from datetime import UTC, datetime

from sqlalchemy import select, text
from sqlalchemy.ext.asyncio import AsyncSession

from app.domain.models.chat import Message, MessageRead


async def get_organization_id_for_message(session: AsyncSession, message_id: uuid.UUID) -> uuid.UUID | None:
    """SECURITY DEFINER-backed lookup, same pattern as channel/project equivalents —
    see core/deps.py get_message_scoped_session and migration 0004."""
    result = await session.execute(
        text("SELECT get_message_organization_id(:message_id) AS org_id").bindparams(message_id=message_id)
    )
    row = result.first()
    return row.org_id if row and row.org_id is not None else None


async def create(
    session: AsyncSession,
    *,
    channel_id: uuid.UUID,
    organization_id: uuid.UUID,
    author_id: uuid.UUID,
    parent_message_id: uuid.UUID | None,
    ciphertext: bytes,
    nonce: bytes,
) -> Message:
    message = Message(
        channel_id=channel_id,
        organization_id=organization_id,
        author_id=author_id,
        parent_message_id=parent_message_id,
        ciphertext=ciphertext,
        nonce=nonce,
    )
    session.add(message)
    await session.flush()
    return message


async def get_by_id(session: AsyncSession, message_id: uuid.UUID) -> Message | None:
    result = await session.execute(
        select(Message).where(Message.id == message_id, Message.deleted_at.is_(None))
    )
    return result.scalar_one_or_none()


async def list_for_channel(
    session: AsyncSession, channel_id: uuid.UUID, *, before: datetime | None = None, limit: int = 50
) -> list[Message]:
    query = select(Message).where(Message.channel_id == channel_id, Message.deleted_at.is_(None))
    if before is not None:
        query = query.where(Message.created_at < before)
    query = query.order_by(Message.created_at.desc()).limit(limit)
    result = await session.execute(query)
    return list(result.scalars().all())


async def soft_delete(session: AsyncSession, message_id: uuid.UUID) -> None:
    message = await get_by_id(session, message_id)
    if message is not None:
        message.deleted_at = datetime.now(UTC)


async def mark_edited(session: AsyncSession, message_id: uuid.UUID, *, ciphertext: bytes, nonce: bytes) -> None:
    message = await get_by_id(session, message_id)
    if message is not None:
        message.ciphertext = ciphertext
        message.nonce = nonce
        message.edited_at = datetime.now(UTC)


async def mark_read(session: AsyncSession, *, message_id: uuid.UUID, user_id: uuid.UUID) -> None:
    existing = await session.execute(
        select(MessageRead).where(MessageRead.message_id == message_id, MessageRead.user_id == user_id)
    )
    if existing.scalar_one_or_none() is None:
        session.add(MessageRead(message_id=message_id, user_id=user_id))


async def upsert_search_index(
    session: AsyncSession, *, message_id: uuid.UUID, organization_id: uuid.UUID, channel_id: uuid.UUID, plaintext: str
) -> None:
    """Populates the derived plaintext search index at write time (Encryption Design
    doc §8) — the server necessarily holds plaintext transiently here since it just
    encrypted/decrypted this exact message; that's the resolved tradeoff, not a leak."""
    await session.execute(
        text(
            """
            INSERT INTO message_search_index (message_id, organization_id, channel_id, tsv)
            VALUES (:message_id, :organization_id, :channel_id, to_tsvector('english', :plaintext))
            ON CONFLICT (message_id) DO UPDATE SET tsv = EXCLUDED.tsv
            """
        ).bindparams(message_id=message_id, organization_id=organization_id, channel_id=channel_id, plaintext=plaintext)
    )


async def delete_search_index(session: AsyncSession, message_id: uuid.UUID) -> None:
    await session.execute(
        text("DELETE FROM message_search_index WHERE message_id = :message_id").bindparams(message_id=message_id)
    )


async def search_channel(session: AsyncSession, *, channel_id: uuid.UUID, query: str, limit: int = 20) -> list[uuid.UUID]:
    """Returns matching message ids, ranked. The query string goes through
    plainto_tsquery (parameterized, never string-concatenated) so user input can never
    break out into arbitrary tsquery syntax (Pentest Checklist §3 SQL/query injection)."""
    result = await session.execute(
        text(
            """
            SELECT message_id FROM message_search_index
            WHERE channel_id = :channel_id AND tsv @@ plainto_tsquery('english', :query)
            ORDER BY ts_rank(tsv, plainto_tsquery('english', :query)) DESC
            LIMIT :limit
            """
        ).bindparams(channel_id=channel_id, query=query, limit=limit)
    )
    return [row.message_id for row in result.all()]
