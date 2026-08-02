"""Pentest Checklist §4: storage_key must never allow escaping the storage root."""

import sys

import pytest

from app.core.storage import FileStorage, StorageError


@pytest.fixture
def storage(tmp_path) -> FileStorage:
    return FileStorage(str(tmp_path))


async def test_write_read_round_trip(storage: FileStorage) -> None:
    key = storage.generate_storage_key()
    await storage.write(key, b"secret bytes")
    assert await storage.read(key) == b"secret bytes"


async def test_generated_keys_are_unique(storage: FileStorage) -> None:
    keys = {storage.generate_storage_key() for _ in range(50)}
    assert len(keys) == 50


@pytest.mark.parametrize(
    "malicious_key",
    [
        "../../etc/passwd",
        "..%2f..%2fetc%2fpasswd",
        "/etc/passwd",
        "a/../../b",
        "..",
        "a" * 100,  # too long
        "not-hex!",
    ],
)
async def test_path_traversal_storage_keys_rejected(storage: FileStorage, malicious_key: str) -> None:
    with pytest.raises(StorageError):
        await storage.write(malicious_key, b"payload")


async def test_read_nonexistent_key_raises(storage: FileStorage) -> None:
    with pytest.raises(StorageError):
        await storage.read("a" * 32)


@pytest.mark.skipif(
    sys.platform == "win32",
    reason="POSIX file mode bits are not meaningful on Windows/NTFS — the deployment "
    "target is Ubuntu LTS (Deployment & Hardening Guide), where this assertion holds; "
    "this check is only skipped for local Windows dev runs, not in Linux CI.",
)
async def test_written_file_has_restrictive_permissions(storage: FileStorage, tmp_path) -> None:
    key = storage.generate_storage_key()
    await storage.write(key, b"data")
    path = tmp_path / key
    mode = path.stat().st_mode & 0o777
    assert mode == 0o600
