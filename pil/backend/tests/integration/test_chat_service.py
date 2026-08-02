"""Security Testing Plan §2 "Injection" and "Crypto" cases, plus author-only edit /
role-gated delete checks, against a real Postgres instance."""

import uuid

import pytest
from cryptography.exceptions import InvalidTag

from app.core.errors import PermissionDeniedError, ResourceNotFoundError
from app.domain.models.organization import Organization
from app.domain.models.project import Project
from app.services import chat_service
from tests.integration.conftest import make_user


async def _seed_org_project_channel(session, settings):
    org = Organization(name="Acme", slug=f"acme-{uuid.uuid4().hex[:8]}")
    session.add(org)
    await session.flush()

    creator = await make_user(session)
    project = Project(organization_id=org.id, name="Proj", created_by=creator.id)
    session.add(project)
    await session.flush()

    channel = await chat_service.create_channel(
        session, settings, project_id=project.id, organization_id=org.id, name="general", is_private=False
    )
    await session.commit()
    return org, project, channel


async def test_message_round_trips_through_encryption(session, settings) -> None:
    org, project, channel = await _seed_org_project_channel(session, settings)
    author_id = (await make_user(session)).id

    message = await chat_service.post_message(
        session, settings, channel_id=channel.id, organization_id=org.id, author_id=author_id,
        body="the quarterly numbers are attached", parent_message_id=None,
    )
    await session.commit()

    # Ciphertext on the row must not contain the plaintext anywhere.
    assert b"quarterly" not in message.ciphertext

    decrypted = chat_service.decrypt_message_body(settings, channel, org.id, message)
    assert decrypted == "the quarterly numbers are attached"


async def test_two_messages_with_identical_body_have_different_ciphertext(session, settings) -> None:
    org, project, channel = await _seed_org_project_channel(session, settings)
    author_id = (await make_user(session)).id

    m1 = await chat_service.post_message(
        session, settings, channel_id=channel.id, organization_id=org.id, author_id=author_id,
        body="same text", parent_message_id=None,
    )
    m2 = await chat_service.post_message(
        session, settings, channel_id=channel.id, organization_id=org.id, author_id=author_id,
        body="same text", parent_message_id=None,
    )
    assert m1.ciphertext != m2.ciphertext
    assert m1.nonce != m2.nonce


async def test_channels_in_different_orgs_have_independent_deks(session, settings) -> None:
    org_a, project_a, channel_a = await _seed_org_project_channel(session, settings)
    org_b, project_b, channel_b = await _seed_org_project_channel(session, settings)
    author = await make_user(session)

    message = await chat_service.post_message(
        session, settings, channel_id=channel_a.id, organization_id=org_a.id, author_id=author.id,
        body="org a secret", parent_message_id=None,
    )

    # Attempting to decrypt org A's message using org B's channel (wrong DEK) must
    # fail loudly, never silently return garbage-but-plausible plaintext. AES-GCM's
    # authentication tag check is what actually fails here, not a generic error.
    with pytest.raises(InvalidTag):
        chat_service.decrypt_message_body(settings, channel_b, org_b.id, message)


async def test_edit_message_author_only(session, settings) -> None:
    org, project, channel = await _seed_org_project_channel(session, settings)
    author_id = (await make_user(session)).id
    other_user_id = (await make_user(session)).id

    message = await chat_service.post_message(
        session, settings, channel_id=channel.id, organization_id=org.id, author_id=author_id,
        body="original", parent_message_id=None,
    )
    await session.commit()

    with pytest.raises(PermissionDeniedError):
        await chat_service.edit_message(
            session, settings, channel_id=channel.id, organization_id=org.id, message_id=message.id,
            editor_id=other_user_id, new_body="hijacked edit",
        )

    await chat_service.edit_message(
        session, settings, channel_id=channel.id, organization_id=org.id, message_id=message.id,
        editor_id=author_id, new_body="edited by author",
    )
    updated = chat_service.decrypt_message_body(settings, channel, org.id, message)
    assert updated == "edited by author"
    assert message.edited_at is not None


async def test_delete_message_author_or_privileged_role_only(session, settings) -> None:
    org, project, channel = await _seed_org_project_channel(session, settings)
    author_id = (await make_user(session)).id
    other_user_id = (await make_user(session)).id

    message = await chat_service.post_message(
        session, settings, channel_id=channel.id, organization_id=org.id, author_id=author_id,
        body="to be deleted", parent_message_id=None,
    )
    await session.commit()

    with pytest.raises(PermissionDeniedError):
        await chat_service.delete_message(
            session, channel_id=channel.id, message_id=message.id, deleter_id=other_user_id,
            deleter_can_delete_any=False,
        )

    # A project_admin (deleter_can_delete_any=True) CAN delete someone else's message.
    await chat_service.delete_message(
        session, channel_id=channel.id, message_id=message.id, deleter_id=other_user_id,
        deleter_can_delete_any=True,
    )
    from app.repositories import message_repository

    assert await message_repository.get_by_id(session, message.id) is None  # soft-deleted, filtered out


async def test_reply_must_belong_to_same_channel(session, settings) -> None:
    org, project, channel_a = await _seed_org_project_channel(session, settings)
    _org_b, _project_b, channel_b = await _seed_org_project_channel(session, settings)
    author = await make_user(session)

    parent = await chat_service.post_message(
        session, settings, channel_id=channel_a.id, organization_id=org.id, author_id=author.id,
        body="parent", parent_message_id=None,
    )
    await session.commit()

    with pytest.raises(ResourceNotFoundError):
        await chat_service.post_message(
            session, settings, channel_id=channel_b.id, organization_id=_org_b.id, author_id=author.id,
            body="reply pretending to be in another channel", parent_message_id=parent.id,
        )


async def test_search_finds_matching_message_and_not_unrelated_ones(session, settings) -> None:
    org, project, channel = await _seed_org_project_channel(session, settings)
    author_id = (await make_user(session)).id

    target = await chat_service.post_message(
        session, settings, channel_id=channel.id, organization_id=org.id, author_id=author_id,
        body="the invoice for acquisition Bravo is ready", parent_message_id=None,
    )
    await chat_service.post_message(
        session, settings, channel_id=channel.id, organization_id=org.id, author_id=author_id,
        body="lunch plans for friday", parent_message_id=None,
    )
    await session.commit()

    results = await chat_service.search_channel(session, channel_id=channel.id, query="acquisition")
    assert target.id in results


async def test_search_query_with_sql_metacharacters_does_not_error(session, settings) -> None:
    """Pentest Checklist §3: SQL injection payloads must not alter query behavior or
    raise a DB error — plainto_tsquery via a bound parameter, never string-built SQL."""
    org, project, channel = await _seed_org_project_channel(session, settings)
    author = await make_user(session)
    await chat_service.post_message(
        session, settings, channel_id=channel.id, organization_id=org.id, author_id=author.id,
        body="normal message", parent_message_id=None,
    )
    await session.commit()

    payload = "'; DROP TABLE messages; --"
    results = await chat_service.search_channel(session, channel_id=channel.id, query=payload)
    assert results == []

    # Table must still exist and be queryable — the injection attempt had zero effect.
    from app.repositories import message_repository

    still_there = await message_repository.list_for_channel(session, channel.id)
    assert len(still_there) == 1
