import os

import pytest
from cryptography.exceptions import InvalidTag

from app.core.security.crypto import (
    decrypt,
    derive_org_kek,
    encrypt,
    generate_dek,
    unwrap_dek,
    wrap_dek,
)


def test_envelope_encryption_round_trip() -> None:
    root_secret = os.urandom(32)
    kek = derive_org_kek(root_secret, "org-123")
    dek = generate_dek()

    wrapped = wrap_dek(dek, kek)
    recovered_dek = unwrap_dek(wrapped, kek)
    assert recovered_dek == dek

    ciphertext, nonce = encrypt(b"confidential document contents", recovered_dek)
    plaintext = decrypt(ciphertext, nonce, recovered_dek)
    assert plaintext == b"confidential document contents"


def test_wrong_kek_cannot_unwrap_dek() -> None:
    root_secret = os.urandom(32)
    kek_a = derive_org_kek(root_secret, "org-a")
    kek_b = derive_org_kek(root_secret, "org-b")
    dek = generate_dek()
    wrapped = wrap_dek(dek, kek_a)

    with pytest.raises(InvalidTag):
        unwrap_dek(wrapped, kek_b)


def test_nonce_uniqueness_across_encryptions() -> None:
    dek = generate_dek()
    _, nonce1 = encrypt(b"same plaintext", dek)
    _, nonce2 = encrypt(b"same plaintext", dek)
    assert nonce1 != nonce2


def test_ciphertext_differs_for_identical_plaintext() -> None:
    dek = generate_dek()
    ciphertext1, _ = encrypt(b"same plaintext", dek)
    ciphertext2, _ = encrypt(b"same plaintext", dek)
    assert ciphertext1 != ciphertext2


def test_org_kek_derivation_is_deterministic_and_org_scoped() -> None:
    root_secret = os.urandom(32)
    kek_a1 = derive_org_kek(root_secret, "org-a")
    kek_a2 = derive_org_kek(root_secret, "org-a")
    kek_b = derive_org_kek(root_secret, "org-b")
    assert kek_a1 == kek_a2
    assert kek_a1 != kek_b
