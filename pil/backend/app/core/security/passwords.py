"""Argon2id password hashing, per OWASP Password Storage Cheat Sheet defaults."""

from __future__ import annotations

from argon2 import PasswordHasher
from argon2.exceptions import InvalidHashError, VerificationError, VerifyMismatchError

# Tuned for ~250ms+ hash time on typical prod hardware; adjust per deployment benchmarking.
_hasher = PasswordHasher(
    time_cost=3,
    memory_cost=65536,  # 64 MiB
    parallelism=2,
    hash_len=32,
    salt_len=16,
)

# A fixed, never-matching hash used to keep login timing constant when the alias doesn't
# exist, so response timing doesn't disclose account existence.
_DUMMY_HASH = _hasher.hash("dummy-password-for-timing-parity")


def hash_password(password: str) -> str:
    return _hasher.hash(password)


def verify_password(password: str, password_hash: str | None) -> bool:
    """Verify a password against a hash. Always performs a hash operation, even when
    password_hash is None (unknown account), to avoid a timing oracle for enumeration."""
    target = password_hash or _DUMMY_HASH
    try:
        _hasher.verify(target, password)
    except (VerifyMismatchError, VerificationError, InvalidHashError):
        return False
    return password_hash is not None


def needs_rehash(password_hash: str) -> bool:
    return _hasher.check_needs_rehash(password_hash)
