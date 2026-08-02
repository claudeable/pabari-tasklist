"""Envelope encryption primitives (Encryption Design doc §2, §4).

Key hierarchy: Root Secret -> per-org KEK (HKDF) -> per-object DEK (AES-256-GCM).

Root secret loader is isolated behind `RootSecretProvider` specifically so it can be
swapped for an HSM/PKCS#11-backed provider later (Encryption Design §2, accepted-risk
upgrade path) without touching any calling code.
"""

from __future__ import annotations

import os
from abc import ABC, abstractmethod
from dataclasses import dataclass

from cryptography.hazmat.primitives import hashes
from cryptography.hazmat.primitives.ciphers.aead import AESGCM
from cryptography.hazmat.primitives.kdf.hkdf import HKDF

NONCE_LEN = 12  # 96-bit, per NIST SP 800-38D recommendation for GCM
KEY_LEN = 32  # AES-256


class RootSecretProvider(ABC):
    @abstractmethod
    def get_root_secret(self) -> bytes: ...


class FileRootSecretProvider(RootSecretProvider):
    """v1 default: reads the root secret from a 0400 file (Docker secret mount).
    See Encryption Design doc §2 for the accepted-risk statement and HSM upgrade path."""

    def __init__(self, path: str) -> None:
        self._path = path

    def get_root_secret(self) -> bytes:
        with open(self._path, "rb") as f:
            return f.read().strip()


@dataclass(frozen=True)
class WrappedKey:
    ciphertext: bytes
    nonce: bytes
    key_version: int


def derive_org_kek(root_secret: bytes, organization_id: str, *, key_version: int = 1) -> bytes:
    """HKDF-SHA256 derivation of a per-organization Key Encryption Key."""
    info = f"scv:org-kek:v{key_version}:{organization_id}".encode()
    hkdf = HKDF(algorithm=hashes.SHA256(), length=KEY_LEN, salt=None, info=info)
    return hkdf.derive(root_secret)


def generate_dek() -> bytes:
    return os.urandom(KEY_LEN)


def wrap_dek(dek: bytes, kek: bytes, *, key_version: int = 1) -> WrappedKey:
    aesgcm = AESGCM(kek)
    nonce = os.urandom(NONCE_LEN)
    ciphertext = aesgcm.encrypt(nonce, dek, None)
    return WrappedKey(ciphertext=ciphertext, nonce=nonce, key_version=key_version)


def unwrap_dek(wrapped: WrappedKey, kek: bytes) -> bytes:
    aesgcm = AESGCM(kek)
    return aesgcm.decrypt(wrapped.nonce, wrapped.ciphertext, None)


def encrypt(plaintext: bytes, dek: bytes, *, associated_data: bytes | None = None) -> tuple[bytes, bytes]:
    """Returns (ciphertext, nonce). Fresh CSPRNG nonce per call — never reused with a DEK."""
    aesgcm = AESGCM(dek)
    nonce = os.urandom(NONCE_LEN)
    ciphertext = aesgcm.encrypt(nonce, plaintext, associated_data)
    return ciphertext, nonce


def decrypt(ciphertext: bytes, nonce: bytes, dek: bytes, *, associated_data: bytes | None = None) -> bytes:
    aesgcm = AESGCM(dek)
    return aesgcm.decrypt(nonce, ciphertext, associated_data)


def encrypt_for_subject(root_secret: bytes, subject: str, plaintext: bytes) -> str:
    """Encrypts a small secret (TOTP seed, etc.) under a subject-scoped key derived
    from the root secret — same HKDF-per-subject pattern as the org KEK (Encryption
    Design doc §3), just keyed by an arbitrary subject string instead of org_id.
    Returns a base64 string of nonce||ciphertext for compact column storage."""
    import base64

    kek = derive_org_kek(root_secret, subject)
    ciphertext, nonce = encrypt(plaintext, kek)
    return base64.b64encode(nonce + ciphertext).decode()


def decrypt_for_subject(root_secret: bytes, subject: str, encoded: str) -> bytes:
    import base64

    kek = derive_org_kek(root_secret, subject)
    raw = base64.b64decode(encoded)
    nonce, ciphertext = raw[:NONCE_LEN], raw[NONCE_LEN:]
    return decrypt(ciphertext, nonce, kek)
