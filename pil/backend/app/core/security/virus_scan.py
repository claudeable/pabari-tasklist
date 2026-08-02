"""Virus scanning hook (Deployment & Hardening Guide §6: ClamAV daemon on the internal
network; every upload passes through a scan step before scan_status=clean).

`VirusScanner` is an explicit interface (Repository Pattern / Dependency Injection,
per coding standards) specifically so `StubScanner` — which does NOT actually scan
anything — can never be silently substituted for the real `ClamdScanner` in a
production config by accident: the app factory wires the scanner from an explicit
`settings.virus_scan_enabled` flag, and `StubScanner` refuses to run outside
environment=test/development (see its __init__).
"""

from __future__ import annotations

import asyncio
from abc import ABC, abstractmethod
from dataclasses import dataclass

_CHUNK_SIZE = 8192
_INSTREAM_MAX_BYTES = 100 * 1024 * 1024


@dataclass(frozen=True)
class ScanResult:
    clean: bool
    signature: str | None = None


class VirusScanError(Exception):
    pass


class VirusScanner(ABC):
    @abstractmethod
    async def scan(self, data: bytes) -> ScanResult: ...


class ClamdScanner(VirusScanner):
    """Speaks ClamAV's INSTREAM protocol directly over TCP — no extra dependency."""

    def __init__(self, host: str, port: int, *, timeout_seconds: float = 30.0) -> None:
        self._host = host
        self._port = port
        self._timeout = timeout_seconds

    async def scan(self, data: bytes) -> ScanResult:
        if len(data) > _INSTREAM_MAX_BYTES:
            raise VirusScanError("File exceeds clamd INSTREAM size limit")

        try:
            reader, writer = await asyncio.wait_for(
                asyncio.open_connection(self._host, self._port), timeout=self._timeout
            )
        except OSError as exc:
            raise VirusScanError(f"Could not connect to clamd: {exc}") from exc

        try:
            writer.write(b"zINSTREAM\0")
            for offset in range(0, len(data), _CHUNK_SIZE):
                chunk = data[offset : offset + _CHUNK_SIZE]
                writer.write(len(chunk).to_bytes(4, "big") + chunk)
            writer.write((0).to_bytes(4, "big"))  # zero-length chunk terminates the stream
            await writer.drain()

            raw_response = await asyncio.wait_for(reader.read(4096), timeout=self._timeout)
        finally:
            writer.close()
            await writer.wait_closed()

        response = raw_response.decode(errors="replace").strip("\0").strip()
        if response.endswith("OK"):
            return ScanResult(clean=True)
        if "FOUND" in response:
            signature = response.split(":", 1)[-1].replace("FOUND", "").strip()
            return ScanResult(clean=False, signature=signature)
        raise VirusScanError(f"Unexpected clamd response: {response!r}")


class StubScanner(VirusScanner):
    """Always reports clean WITHOUT actually scanning — dev/test convenience only.
    Refuses to instantiate outside environment in {"development", "test"} so it can
    never end up wired into a production deployment by a misconfigured settings flag."""

    def __init__(self, *, environment: str) -> None:
        if environment not in ("development", "test"):
            raise RuntimeError(
                "StubScanner must never be used outside development/test — "
                "a production deployment needs settings.virus_scan_enabled=true "
                "with a real ClamdScanner (Deployment & Hardening Guide §6)."
            )
        self._environment = environment

    async def scan(self, data: bytes) -> ScanResult:
        return ScanResult(clean=True)
