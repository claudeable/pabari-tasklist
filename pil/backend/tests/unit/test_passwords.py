from app.core.security.passwords import hash_password, needs_rehash, verify_password


def test_hash_and_verify_round_trip() -> None:
    hashed = hash_password("a-reasonably-strong-passphrase")
    assert verify_password("a-reasonably-strong-passphrase", hashed) is True


def test_verify_rejects_wrong_password() -> None:
    hashed = hash_password("correct-horse-battery-staple")
    assert verify_password("wrong-password", hashed) is False


def test_verify_handles_none_hash_without_raising() -> None:
    # Simulates an unknown alias — must behave like a real (failing) verification,
    # not short-circuit, so response timing doesn't disclose account existence.
    assert verify_password("anything", None) is False


def test_hash_is_not_plaintext() -> None:
    hashed = hash_password("supersecret")
    assert "supersecret" not in hashed
    assert hashed.startswith("$argon2id$")


def test_needs_rehash_false_for_current_params() -> None:
    hashed = hash_password("supersecret")
    assert needs_rehash(hashed) is False
