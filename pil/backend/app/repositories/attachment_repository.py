from __future__ import annotations

import uuid

from sqlalchemy import select, text
from sqlalchemy.ext.asyncio import AsyncSession

from app.domain.models.chat import MessageAttachment


async def get_organization_id_for_attachment(session: AsyncSession, attachment_id: uuid.UUID) -> uuid.UUID | None:
    """SECURITY DEFINER-backed lookup, same pattern as channel/message equivalents —
    see core/deps.py get_attachment_scoped_session and migration 0013."""
    result = await session.execute(
        text("SELECT get_attachment_organization_id(:attachment_id) AS org_id").bindparams(
            attachment_id=attachment_id
        )
    )
    row = result.first()
    return row.org_id if row and row.org_id is not None else None


async def create(
    session: AsyncSession,
    *,
    message_id: uuid.UUID,
    channel_id: uuid.UUID,
    organization_id: uuid.UUID,
    storage_key: str,
    encrypted_dek: str,
    file_hash_sha256: str,
    size_bytes: int,
    mime_type: str,
    original_filename: str,
    uploaded_by: uuid.UUID,
) -> MessageAttachment:
    attachment = MessageAttachment(
        message_id=message_id,
        channel_id=channel_id,
        organization_id=organization_id,
        storage_key=storage_key,
        encrypted_dek=encrypted_dek,
        file_hash_sha256=file_hash_sha256,
        size_bytes=size_bytes,
        mime_type=mime_type,
        original_filename=original_filename,
        uploaded_by=uploaded_by,
    )
    session.add(attachment)
    await session.flush()
    return attachment


async def get_by_id(session: AsyncSession, attachment_id: uuid.UUID) -> MessageAttachment | None:
    result = await session.execute(select(MessageAttachment).where(MessageAttachment.id == attachment_id))
    return result.scalar_one_or_none()


async def get_for_message(session: AsyncSession, message_id: uuid.UUID) -> MessageAttachment | None:
    result = await session.execute(
        select(MessageAttachment).where(MessageAttachment.message_id == message_id)
    )
    return result.scalars().first()


async def get_for_messages(session: AsyncSession, message_ids: list[uuid.UUID]) -> dict[uuid.UUID, MessageAttachment]:
    if not message_ids:
        return {}
    result = await session.execute(
        select(MessageAttachment).where(MessageAttachment.message_id.in_(message_ids))
    )
    return {a.message_id: a for a in result.scalars().all()}
