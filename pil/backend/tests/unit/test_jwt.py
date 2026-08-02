
import pytest
from cryptography.hazmat.primitives import serialization
from cryptography.hazmat.primitives.asymmetric.ed25519 import Ed25519PrivateKey

from app.core.security.jwt import TokenError, issue_access_token, verify_access_token


@pytest.fixture
def keypair() -> tuple[str, str]:
    private_key = Ed25519PrivateKey.generate()
    private_pem = private_key.private_bytes(
        encoding=serialization.Encoding.PEM,
        format=serialization.PrivateFormat.PKCS8,
        encryption_algorithm=serialization.NoEncryption(),
    ).decode()
    public_pem = (
        private_key.public_key()
        .public_bytes(
            encoding=serialization.Encoding.PEM,
            format=serialization.PublicFormat.SubjectPublicKeyInfo,
        )
        .decode()
    )
    return private_pem, public_pem


def test_issue_and_verify_round_trip(keypair: tuple[str, str]) -> None:
    private_pem, public_pem = keypair
    token = issue_access_token(
        user_id="user-1",
        organization_id="org-1",
        mfa_verified=True,
        private_key_pem=private_pem,
        issuer="scv",
        ttl_seconds=60,
    )
    claims = verify_access_token(token, public_key_pem=public_pem, issuer="scv")
    assert claims.sub == "user-1"
    assert claims.org_id == "org-1"
    assert claims.mfa is True


def test_expired_token_rejected(keypair: tuple[str, str]) -> None:
    private_pem, public_pem = keypair
    token = issue_access_token(
        user_id="user-1",
        organization_id=None,
        mfa_verified=False,
        private_key_pem=private_pem,
        issuer="scv",
        ttl_seconds=-1,  # already expired
    )
    with pytest.raises(TokenError):
        verify_access_token(token, public_key_pem=public_pem, issuer="scv")


def test_token_signed_by_different_key_rejected(keypair: tuple[str, str]) -> None:
    private_pem, _ = keypair
    _, attacker_public_pem = _new_keypair()
    token = issue_access_token(
        user_id="user-1",
        organization_id=None,
        mfa_verified=False,
        private_key_pem=private_pem,
        issuer="scv",
        ttl_seconds=60,
    )
    with pytest.raises(TokenError):
        verify_access_token(token, public_key_pem=attacker_public_pem, issuer="scv")


def test_wrong_issuer_rejected(keypair: tuple[str, str]) -> None:
    private_pem, public_pem = keypair
    token = issue_access_token(
        user_id="user-1",
        organization_id=None,
        mfa_verified=False,
        private_key_pem=private_pem,
        issuer="scv",
        ttl_seconds=60,
    )
    with pytest.raises(TokenError):
        verify_access_token(token, public_key_pem=public_pem, issuer="not-scv")


def _new_keypair() -> tuple[str, str]:
    private_key = Ed25519PrivateKey.generate()
    private_pem = private_key.private_bytes(
        encoding=serialization.Encoding.PEM,
        format=serialization.PrivateFormat.PKCS8,
        encryption_algorithm=serialization.NoEncryption(),
    ).decode()
    public_pem = (
        private_key.public_key()
        .public_bytes(
            encoding=serialization.Encoding.PEM,
            format=serialization.PublicFormat.SubjectPublicKeyInfo,
        )
        .decode()
    )
    return private_pem, public_pem
