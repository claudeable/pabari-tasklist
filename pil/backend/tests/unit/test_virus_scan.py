"""Deployment & Hardening Guide §6: a non-scanning stub must never be reachable in a
production configuration."""

import pytest

from app.core.security.virus_scan import ScanResult, StubScanner


async def test_stub_scanner_works_in_test_environment() -> None:
    scanner = StubScanner(environment="test")
    result = await scanner.scan(b"anything")
    assert result == ScanResult(clean=True)


async def test_stub_scanner_works_in_development_environment() -> None:
    scanner = StubScanner(environment="development")
    result = await scanner.scan(b"anything")
    assert result.clean is True


def test_stub_scanner_refuses_to_instantiate_in_production() -> None:
    with pytest.raises(RuntimeError):
        StubScanner(environment="production")
