"""Pentest Checklist §4: signed URL reuse after expiry/consumption; URL tampering.
Encryption Design doc §7 is the design this enforces."""

import uuid

import pytest
from fakeredis.aioredis import FakeRedis

from app.core.download_tokens import DownloadTokenError, issue_download_token, redeem_download_token

ROOT_SECRET = b"x" * 32


@pytest.fixture
async def redis_client():
    client = FakeRedis()
    yield client
    await client.aclose()


def _issue(organization_id=None, document_id=None, version_id=None, ttl=60):
    return issue_download_token(
        root_secret=ROOT_SECRET,
        organization_id=organization_id or uuid.uuid4(),
        document_id=document_id or uuid.uuid4(),
        version_id=version_id or uuid.uuid4(),
        ttl_seconds=ttl,
    )


async def test_valid_token_redeems_to_correct_ids(redis_client) -> None:
    org_id, doc_id, version_id = uuid.uuid4(), uuid.uuid4(), uuid.uuid4()
    token = _issue(org_id, doc_id, version_id)

    redeemed_doc, redeemed_version, redeemed_org = await redeem_download_token(
        redis_client, root_secret=ROOT_SECRET, token=token
    )
    assert (redeemed_doc, redeemed_version, redeemed_org) == (doc_id, version_id, org_id)


async def test_token_is_single_use(redis_client) -> None:
    token = _issue()
    await redeem_download_token(redis_client, root_secret=ROOT_SECRET, token=token)

    with pytest.raises(DownloadTokenError):
        await redeem_download_token(redis_client, root_secret=ROOT_SECRET, token=token)


async def test_expired_token_rejected(redis_client) -> None:
    token = _issue(ttl=-10)
    with pytest.raises(DownloadTokenError):
        await redeem_download_token(redis_client, root_secret=ROOT_SECRET, token=token)


async def test_tampered_document_id_rejected(redis_client) -> None:
    import base64

    token = _issue()
    decoded = base64.urlsafe_b64decode(token.encode()).decode()
    parts = decoded.split("|")
    parts[0] = str(uuid.uuid4())  # swap in an attacker-chosen document id
    tampered = base64.urlsafe_b64encode("|".join(parts).encode()).decode()

    with pytest.raises(DownloadTokenError):
        await redeem_download_token(redis_client, root_secret=ROOT_SECRET, token=tampered)


async def test_tampered_organization_id_rejected(redis_client) -> None:
    """The critical cross-tenant case: an attacker takes a legitimately issued token
    and tries to repoint it at a different org to get a different signing key path.
    Must fail — they don't hold the other org's signing key either."""
    import base64

    token = _issue()
    decoded = base64.urlsafe_b64decode(token.encode()).decode()
    parts = decoded.split("|")
    parts[2] = str(uuid.uuid4())  # swap in a different organization_id
    tampered = base64.urlsafe_b64encode("|".join(parts).encode()).decode()

    with pytest.raises(DownloadTokenError):
        await redeem_download_token(redis_client, root_secret=ROOT_SECRET, token=tampered)


async def test_tampered_signature_rejected(redis_client) -> None:
    import base64

    token = _issue()
    decoded = base64.urlsafe_b64decode(token.encode()).decode()
    parts = decoded.split("|")
    parts[-1] = "0" * 64  # bogus signature
    tampered = base64.urlsafe_b64encode("|".join(parts).encode()).decode()

    with pytest.raises(DownloadTokenError):
        await redeem_download_token(redis_client, root_secret=ROOT_SECRET, token=tampered)


async def test_malformed_token_rejected(redis_client) -> None:
    with pytest.raises(DownloadTokenError):
        await redeem_download_token(redis_client, root_secret=ROOT_SECRET, token="not-a-valid-token-at-all")


async def test_wrong_root_secret_cannot_forge_valid_token(redis_client) -> None:
    """Simulates a scenario where only the correct root secret can mint tokens the
    server will accept — a stolen/guessed document id alone is not enough."""
    token = _issue()
    with pytest.raises(DownloadTokenError):
        await redeem_download_token(redis_client, root_secret=b"y" * 32, token=token)


async def test_two_tokens_for_same_document_are_unlinkable_by_inspection(redis_client) -> None:
    """Nonce randomization means two tokens for the same document don't share any
    obviously-guessable structure beyond the (necessarily stable) ids/expiry."""
    doc_id = uuid.uuid4()
    token1 = _issue(document_id=doc_id)
    token2 = _issue(document_id=doc_id)
    assert token1 != token2
