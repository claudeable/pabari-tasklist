"""Document upload, versioning, check-in/out, approval workflow (Encryption Design
doc §2-3, §7; Threat Model §3.4; Pentest Checklist §4 File Handling)."""

from __future__ import annotations

import hashlib
import re
import uuid
from datetime import UTC, datetime

from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import Settings
from app.core.errors import AppError, ConflictError, PermissionDeniedError, ResourceNotFoundError
from app.core.security.crypto import decrypt, encrypt, encrypt_for_subject, generate_dek
from app.core.security.virus_scan import VirusScanner
from app.core.storage import FileStorage
from app.repositories import document_repository
from app.services.auth_service import resolve_root_secret

_FOLDER_PATH_PATTERN = re.compile(r"^/[A-Za-z0-9 _./-]*$")
_MAX_FOLDER_PATH_LENGTH = 500

# Magic-byte prefixes for the MIME types we allow (Pentest Checklist §4 — never trust
# a client-supplied Content-Type alone; verify against actual file content).
_MAGIC_BYTES: dict[str, tuple[bytes, ...]] = {
    "application/pdf": (b"%PDF-",),
    "image/png": (b"\x89PNG\r\n\x1a\n",),
    "image/jpeg": (b"\xff\xd8\xff",),
    "application/vnd.openxmlformats-officedocument.wordprocessingml.document": (b"PK\x03\x04",),
    "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet": (b"PK\x03\x04",),
    # text/plain has no reliable magic byte; validated by attempted UTF-8 decode instead.
}


class DocumentValidationError(AppError):
    status_code = 400
    title = "Invalid document upload"


def validate_folder_path(folder_path: str) -> str:
    if len(folder_path) > _MAX_FOLDER_PATH_LENGTH or not _FOLDER_PATH_PATTERN.match(folder_path):
        raise DocumentValidationError("Invalid folder path")
    if ".." in folder_path.split("/"):
        raise DocumentValidationError("Invalid folder path")
    return folder_path


def validate_upload(*, filename: str, declared_mime_type: str, data: bytes, settings: Settings) -> None:
    if len(data) == 0:
        raise DocumentValidationError("Empty file")
    if len(data) > settings.max_upload_bytes:
        raise DocumentValidationError("File exceeds maximum upload size")
    if declared_mime_type not in settings.allowed_upload_mime_types:
        raise DocumentValidationError("File type not allowed")

    if declared_mime_type == "text/plain":
        try:
            data.decode("utf-8")
        except UnicodeDecodeError as exc:
            raise DocumentValidationError("File content does not match declared type") from exc
    else:
        expected_prefixes = _MAGIC_BYTES.get(declared_mime_type, ())
        if expected_prefixes and not any(data.startswith(p) for p in expected_prefixes):
            raise DocumentValidationError("File content does not match declared type")

    # Filename is display metadata only — never used to derive a storage path
    # (Threat Model §3.4). Still bound to a sane length/charset to avoid UI weirdness.
    if len(filename) > 255 or "\x00" in filename:
        raise DocumentValidationError("Invalid filename")


async def upload_document(
    session: AsyncSession,
    settings: Settings,
    storage: FileStorage,
    scanner: VirusScanner,
    *,
    project_id: uuid.UUID,
    organization_id: uuid.UUID,
    folder_path: str,
    name: str,
    filename: str,
    mime_type: str,
    data: bytes,
    uploaded_by: uuid.UUID,
):
    folder_path = validate_folder_path(folder_path)
    validate_upload(filename=filename, declared_mime_type=mime_type, data=data, settings=settings)

    document = await document_repository.create_document(
        session, project_id=project_id, organization_id=organization_id,
        folder_path=folder_path, name=name, created_by=uploaded_by,
    )
    version = await _store_version(
        session, settings, storage, scanner,
        document_id=document.id, organization_id=organization_id, mime_type=mime_type,
        filename=filename, data=data, uploaded_by=uploaded_by,
    )
    document.current_version_id = version.id
    await document_repository.upsert_search_index(
        session, document_id=document.id, organization_id=organization_id, project_id=project_id,
        plaintext=f"{name} {filename}",
    )
    return document, version


async def upload_new_version(
    session: AsyncSession,
    settings: Settings,
    storage: FileStorage,
    scanner: VirusScanner,
    *,
    document_id: uuid.UUID,
    organization_id: uuid.UUID,
    filename: str,
    mime_type: str,
    data: bytes,
    uploaded_by: uuid.UUID,
):
    document = await document_repository.get_by_id(session, document_id)
    if document is None:
        raise ResourceNotFoundError()
    if document.checked_out_by is not None and document.checked_out_by != uploaded_by:
        raise ConflictError("Document is checked out by another user")

    validate_upload(filename=filename, declared_mime_type=mime_type, data=data, settings=settings)

    version = await _store_version(
        session, settings, storage, scanner,
        document_id=document.id, organization_id=organization_id, mime_type=mime_type,
        filename=filename, data=data, uploaded_by=uploaded_by,
    )
    document.current_version_id = version.id
    document.status = "draft"  # a new version resets any prior approval (Threat Model:
    # an approved document silently swapped for unreviewed content would defeat the
    # approval workflow entirely)
    return version


async def _store_version(
    session: AsyncSession, settings: Settings, storage: FileStorage, scanner: VirusScanner,
    *, document_id: uuid.UUID, organization_id: uuid.UUID, mime_type: str, filename: str, data: bytes, uploaded_by: uuid.UUID,
):
    root_secret = resolve_root_secret(settings)
    dek = generate_dek()
    wrapped_dek = encrypt_for_subject(root_secret, str(organization_id), dek)

    ciphertext, nonce = encrypt(data, dek)
    file_hash = hashlib.sha256(data).hexdigest()

    storage_key = storage.generate_storage_key()
    # Store nonce||ciphertext together on disk — the DB row only needs the wrapped
    # DEK; the nonce travels with the blob it was generated for.
    await storage.write(storage_key, nonce + ciphertext)

    version_number = await document_repository.next_version_number(session, document_id)
    version = await document_repository.create_version(
        session,
        document_id=document_id,
        version_number=version_number,
        storage_key=storage_key,
        encrypted_dek=wrapped_dek,
        file_hash_sha256=file_hash,
        size_bytes=len(data),
        mime_type=mime_type,
        original_filename=filename,
        uploaded_by=uploaded_by,
    )

    # Scan AFTER persisting metadata (scan_status starts "pending") so an infected
    # upload is recorded and quarantined, not silently discarded with no audit trail.
    try:
        result = await scanner.scan(data)
    except Exception:
        version.scan_status = "error"
        raise
    version.scan_status = "clean" if result.clean else "infected"
    return version


async def get_decrypted_content(settings: Settings, storage: FileStorage, *, organization_id: uuid.UUID, version) -> bytes:
    if version.scan_status != "clean":
        # Infected/pending/error versions are never served, regardless of caller
        # permissions — this is a hard gate, not a role-based one (Pentest Checklist §4).
        raise PermissionDeniedError("This file version is not available for download")

    root_secret = resolve_root_secret(settings)
    from app.core.security.crypto import decrypt_for_subject

    dek = decrypt_for_subject(root_secret, str(organization_id), version.encrypted_dek)
    blob = await storage.read(version.storage_key)
    nonce, ciphertext = blob[:12], blob[12:]
    return decrypt(ciphertext, nonce, dek)


_APPROVABLE_STATUSES = {"draft", "pending_approval"}


async def checkout(session: AsyncSession, *, document_id: uuid.UUID, user_id: uuid.UUID) -> None:
    # Row-locked: without this, two concurrent checkout calls can both observe
    # checked_out_by=None before either writes, and both "win" the lock (Pentest
    # Checklist §4: "Race condition: simultaneous document check-out by two users").
    document = await document_repository.get_by_id_for_update(session, document_id)
    if document is None:
        raise ResourceNotFoundError()
    if document.checked_out_by is not None:
        raise ConflictError("Document is already checked out")
    document.checked_out_by = user_id
    document.checked_out_at = datetime.now(UTC)


async def checkin(session: AsyncSession, *, document_id: uuid.UUID, user_id: uuid.UUID, can_override: bool) -> None:
    document = await document_repository.get_by_id_for_update(session, document_id)
    if document is None:
        raise ResourceNotFoundError()
    if document.checked_out_by is None:
        return
    if document.checked_out_by != user_id and not can_override:
        raise PermissionDeniedError("Document is checked out by another user")
    document.checked_out_by = None
    document.checked_out_at = None


async def submit_for_approval(session: AsyncSession, *, document_id: uuid.UUID) -> None:
    document = await document_repository.get_by_id_for_update(session, document_id)
    if document is None:
        raise ResourceNotFoundError()
    if document.status != "draft":
        raise ConflictError(f"Cannot submit for approval from status '{document.status}'")
    document.status = "pending_approval"


async def approve(session: AsyncSession, *, document_id: uuid.UUID) -> None:
    # Row-locked so two concurrent approve/reject calls on the same document
    # serialize instead of racing (Pentest Checklist §5: "Race condition: simultaneous
    # approval/rejection of the same document"). Status is also validated, not just
    # blindly overwritten — an already-approved or already-rejected document cannot be
    # re-approved via a replayed/duplicated request; a new version must be uploaded
    # first, which resets status to 'draft' (Pentest Checklist §5: "Task/document
    # approval workflow bypass (skip states via direct API call)").
    document = await document_repository.get_by_id_for_update(session, document_id)
    if document is None:
        raise ResourceNotFoundError()
    if document.status not in _APPROVABLE_STATUSES:
        raise ConflictError(f"Cannot approve a document with status '{document.status}'")
    document.status = "approved"


async def reject(session: AsyncSession, *, document_id: uuid.UUID) -> None:
    document = await document_repository.get_by_id_for_update(session, document_id)
    if document is None:
        raise ResourceNotFoundError()
    if document.status not in _APPROVABLE_STATUSES:
        raise ConflictError(f"Cannot reject a document with status '{document.status}'")
    document.status = "rejected"


async def delete_document(session: AsyncSession, *, document_id: uuid.UUID) -> None:
    await document_repository.soft_delete(session, document_id)
