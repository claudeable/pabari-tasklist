"""Pentest Checklist §4 File Handling: path traversal, magic-byte/MIME validation."""

import pytest

from app.core.config import Settings
from app.services.document_service import DocumentValidationError, validate_folder_path, validate_upload


def _settings(**overrides) -> Settings:
    defaults = dict(
        database_url="postgresql+asyncpg://x:x@localhost/x",
        redis_url="redis://localhost:6379/0",
        root_secret="x" * 32,
        max_upload_bytes=10 * 1024 * 1024,
        allowed_upload_mime_types=["application/pdf", "image/png", "text/plain"],
    )
    defaults.update(overrides)
    return Settings(**defaults)


def test_valid_folder_path_accepted() -> None:
    assert validate_folder_path("/contracts/2026") == "/contracts/2026"


@pytest.mark.parametrize(
    "path",
    [
        "/../etc/passwd",
        "/contracts/../../etc/passwd",
        "../../../etc/passwd",
        "/contracts/..",
        "/con\x00tracts",
    ],
)
def test_path_traversal_attempts_rejected(path: str) -> None:
    with pytest.raises(DocumentValidationError):
        validate_folder_path(path)


def test_overlong_folder_path_rejected() -> None:
    with pytest.raises(DocumentValidationError):
        validate_folder_path("/" + "a" * 600)


def test_pdf_magic_bytes_required_for_declared_pdf() -> None:
    settings = _settings()
    with pytest.raises(DocumentValidationError):
        validate_upload(filename="fake.pdf", declared_mime_type="application/pdf", data=b"not a real pdf", settings=settings)

    validate_upload(filename="real.pdf", declared_mime_type="application/pdf", data=b"%PDF-1.4 rest of file", settings=settings)


def test_disallowed_mime_type_rejected() -> None:
    settings = _settings()
    with pytest.raises(DocumentValidationError):
        validate_upload(
            filename="script.sh", declared_mime_type="application/x-sh", data=b"#!/bin/sh\necho hi", settings=settings
        )


def test_executable_disguised_as_pdf_rejected() -> None:
    """The classic upload-bypass: attacker sets Content-Type: application/pdf on an
    ELF/PE binary. Magic-byte check must catch it regardless of declared type."""
    settings = _settings()
    elf_header = b"\x7fELF" + b"\x00" * 20
    with pytest.raises(DocumentValidationError):
        validate_upload(filename="invoice.pdf", declared_mime_type="application/pdf", data=elf_header, settings=settings)


def test_oversized_file_rejected() -> None:
    settings = _settings(max_upload_bytes=10)
    with pytest.raises(DocumentValidationError):
        validate_upload(filename="big.txt", declared_mime_type="text/plain", data=b"x" * 11, settings=settings)


def test_empty_file_rejected() -> None:
    settings = _settings()
    with pytest.raises(DocumentValidationError):
        validate_upload(filename="empty.txt", declared_mime_type="text/plain", data=b"", settings=settings)


def test_filename_with_null_byte_rejected() -> None:
    settings = _settings()
    with pytest.raises(DocumentValidationError):
        validate_upload(
            filename="evil.txt\x00.pdf", declared_mime_type="text/plain", data=b"hello world", settings=settings
        )
