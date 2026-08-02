"""Encrypted file storage on disk (Deployment & Hardening Guide §6: volume mounted
`noexec,nosuid,nodev`; this module never executes or interprets stored content).

Storage keys are server-generated random UUIDs, never derived from client-supplied
filenames — closes the path-traversal class of bug at the source rather than trying to
sanitize a hostile filename (Threat Model §3.4, Pentest Checklist §4).
"""

from __future__ import annotations

import asyncio
import uuid
from pathlib import Path


class StorageError(Exception):
    pass


class FileStorage:
    def __init__(self, base_path: str) -> None:
        self._base_path = Path(base_path)

    def generate_storage_key(self) -> str:
        return uuid.uuid4().hex

    def _resolve(self, storage_key: str) -> Path:
        # Defense in depth even though storage_key is always server-generated: reject
        # anything that isn't a bare hex token before it ever touches the filesystem.
        if not storage_key.isalnum() or len(storage_key) > 64:
            raise StorageError("Invalid storage key")
        path = (self._base_path / storage_key).resolve()
        if self._base_path.resolve() not in path.parents and path != self._base_path.resolve():
            raise StorageError("Path escapes storage root")
        return path

    async def write(self, storage_key: str, data: bytes) -> None:
        path = self._resolve(storage_key)

        def _write() -> None:
            self._base_path.mkdir(parents=True, exist_ok=True)
            path.write_bytes(data)
            path.chmod(0o600)

        await asyncio.to_thread(_write)

    async def read(self, storage_key: str) -> bytes:
        path = self._resolve(storage_key)

        def _read() -> bytes:
            if not path.is_file():
                raise StorageError("Blob not found")
            return path.read_bytes()

        return await asyncio.to_thread(_read)

    async def delete(self, storage_key: str) -> None:
        path = self._resolve(storage_key)

        def _delete() -> None:
            path.unlink(missing_ok=True)

        await asyncio.to_thread(_delete)
