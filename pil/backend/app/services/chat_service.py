"""Channel/message creation and encryption (Encryption Design doc §2-3, §8)."""

from __future__ import annotations

import re
import uuid

from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import Settings
from app.core.errors import PermissionDeniedError, ResourceNotFoundError
from app.core.security.crypto import decrypt, decrypt_for_subject, encrypt, encrypt_for_subject, generate_dek
from app.repositories import channel_repository, message_repository
from app.services import notification_service
from app.services.auth_service import resolve_root_secret

# Must match the alias format exactly (schemas/auth.py _ALIAS_PATTERN, migration
# 0001 ck_users_alias_format) — including the hyphen, since the product's own alias
# convention is "Falcon-01" and a mention regex that can't match a real alias is
# useless (caught by actually running the test suite against a live DB, not by lint).
_MENTION_PATTERN = re.compile(r"@([A-Za-z][A-Za-z0-9-]{1,30}[A-Za-z0-9])")


async def create_channel(
    session: AsyncSession,
    settings: Settings,
    *,
    project_id: uuid.UUID,
    organization_id: uuid.UUID,
    name: str,
    is_private: bool,
):
    root_secret = resolve_root_secret(settings)
    dek = generate_dek()
    wrapped_dek = encrypt_for_subject(root_secret, str(organization_id), dek)

    return await channel_repository.create(
        session,
        project_id=project_id,
        organization_id=organization_id,
        name=name,
        is_private=is_private,
        encrypted_dek=wrapped_dek,
    )


def _channel_dek(settings: Settings, channel, organization_id: uuid.UUID) -> bytes:
    root_secret = resolve_root_secret(settings)
    return decrypt_for_subject(root_secret, str(organization_id), channel.encrypted_dek)


def extract_mentions(body: str) -> list[str]:
    return list(dict.fromkeys(_MENTION_PATTERN.findall(body)))  # de-duplicated, order preserved


async def post_message(
    session: AsyncSession,
    settings: Settings,
    *,
    channel_id: uuid.UUID,
    organization_id: uuid.UUID,
    author_id: uuid.UUID,
    body: str,
    parent_message_id: uuid.UUID | None,
):
    channel = await channel_repository.get_by_id(session, channel_id)
    if channel is None:
        raise ResourceNotFoundError()

    if parent_message_id is not None:
        parent = await message_repository.get_by_id(session, parent_message_id)
        if parent is None or parent.channel_id != channel_id:
            raise ResourceNotFoundError("Parent message not found in this channel")

    dek = _channel_dek(settings, channel, organization_id)
    ciphertext, nonce = encrypt(body.encode("utf-8"), dek)

    message = await message_repository.create(
        session,
        channel_id=channel_id,
        organization_id=organization_id,
        author_id=author_id,
        parent_message_id=parent_message_id,
        ciphertext=ciphertext,
        nonce=nonce,
    )
    await message_repository.upsert_search_index(
        session, message_id=message.id, organization_id=organization_id, channel_id=channel_id, plaintext=body
    )

    mentions = extract_mentions(body)
    if mentions:
        await notification_service.notify_mentions(
            session, aliases=mentions, message_id=message.id, channel_id=channel_id,
            project_id=channel.project_id, organization_id=organization_id, author_id=author_id
        )

    return message


def decrypt_message_body(settings: Settings, channel, organization_id: uuid.UUID, message) -> str:
    dek = _channel_dek(settings, channel, organization_id)
    return decrypt(message.ciphertext, message.nonce, dek).decode("utf-8")


def decrypt_body(settings: Settings, channel, organization_id: uuid.UUID, ciphertext: bytes, nonce: bytes) -> str:
    """Same as decrypt_message_body but for callers (the WS gateway) that only have
    raw ciphertext/nonce bytes off the Redis pub/sub bus, not a persisted Message row."""
    dek = _channel_dek(settings, channel, organization_id)
    return decrypt(ciphertext, nonce, dek).decode("utf-8")


async def edit_message(
    session: AsyncSession,
    settings: Settings,
    *,
    channel_id: uuid.UUID,
    organization_id: uuid.UUID,
    message_id: uuid.UUID,
    editor_id: uuid.UUID,
    new_body: str,
) -> None:
    message = await message_repository.get_by_id(session, message_id)
    if message is None or message.channel_id != channel_id:
        raise ResourceNotFoundError()
    if message.author_id != editor_id:
        # Author-only, regardless of project role — even a project_admin cannot edit
        # someone else's message content (only delete it; see delete_message).
        raise PermissionDeniedError("Only the author can edit this message")

    channel = await channel_repository.get_by_id(session, channel_id)
    dek = _channel_dek(settings, channel, organization_id)
    ciphertext, nonce = encrypt(new_body.encode("utf-8"), dek)

    await message_repository.mark_edited(session, message_id, ciphertext=ciphertext, nonce=nonce)
    await message_repository.upsert_search_index(
        session, message_id=message_id, organization_id=organization_id, channel_id=channel_id, plaintext=new_body
    )


async def delete_message(
    session: AsyncSession,
    *,
    channel_id: uuid.UUID,
    message_id: uuid.UUID,
    deleter_id: uuid.UUID,
    deleter_can_delete_any: bool,
) -> None:
    message = await message_repository.get_by_id(session, message_id)
    if message is None or message.channel_id != channel_id:
        raise ResourceNotFoundError()
    if message.author_id != deleter_id and not deleter_can_delete_any:
        raise PermissionDeniedError("Only the author or a project admin can delete this message")

    await message_repository.soft_delete(session, message_id)
    await message_repository.delete_search_index(session, message_id)


async def mark_read(session: AsyncSession, *, message_id: uuid.UUID, user_id: uuid.UUID) -> None:
    await message_repository.mark_read(session, message_id=message_id, user_id=user_id)


async def search_channel(session: AsyncSession, *, channel_id: uuid.UUID, query: str) -> list[uuid.UUID]:
    return await message_repository.search_channel(session, channel_id=channel_id, query=query)
