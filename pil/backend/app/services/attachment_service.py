"""Chat file/photo attachments — reuses document_service's validated upload rules and
the same envelope-encryption/storage helpers, but persists to message_attachments
(its own RLS-scoped table, see migration 0013) instead of documents/document_versions.
"""

from __future__ import annotations

import hashlib
import uuid

from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import Settings
from app.core.errors import PermissionDeniedError
from app.core.security.crypto import decrypt, decrypt_for_subject, encrypt, encrypt_for_subject, generate_dek
from app.core.security.virus_scan import VirusScanner
from app.repositories import attachment_repository
from app.services.auth_service import resolve_root_secret
from app.services.document_service import validate_upload

# Types that a browser can render natively without triggering a save-as prompt.
INLINE_VIEWABLE_MIME_TYPES = {"image/png", "image/jpeg", "application/pdf", "text/plain"}


async def upload_attachment(
    session: AsyncSession,
    settings: Settings,
    storage,
    scanner: VirusScanner,
    *,
    message_id: uuid.UUID,
    channel_id: uuid.UUID,
    organization_id: uuid.UUID,
    filename: str,
    mime_type: str,
    data: bytes,
    uploaded_by: uuid.UUID,
):
    validate_upload(filename=filename, declared_mime_type=mime_type, data=data, settings=settings)

    root_secret = resolve_root_secret(settings)
    dek = generate_dek()
    wrapped_dek = encrypt_for_subject(root_secret, str(organization_id), dek)

    ciphertext, nonce = encrypt(data, dek)
    file_hash = hashlib.sha256(data).hexdigest()

    storage_key = storage.generate_storage_key()
    await storage.write(storage_key, nonce + ciphertext)

    attachment = await attachment_repository.create(
        session,
        message_id=message_id,
        channel_id=channel_id,
        organization_id=organization_id,
        storage_key=storage_key,
        encrypted_dek=wrapped_dek,
        file_hash_sha256=file_hash,
        size_bytes=len(data),
        mime_type=mime_type,
        original_filename=filename,
        uploaded_by=uploaded_by,
    )

    # Scan AFTER persisting metadata, same rationale as document_service._store_version
    # — an infected upload stays recorded (scan_status="infected") rather than
    # vanishing without a trace.
    try:
        result = await scanner.scan(data)
    except Exception:
        attachment.scan_status = "error"
        raise
    attachment.scan_status = "clean" if result.clean else "infected"
    return attachment


async def get_decrypted_content(settings: Settings, storage, *, organization_id: uuid.UUID, attachment) -> bytes:
    if attachment.scan_status != "clean":
        raise PermissionDeniedError("This attachment is not available")

    root_secret = resolve_root_secret(settings)
    dek = decrypt_for_subject(root_secret, str(organization_id), attachment.encrypted_dek)
    blob = await storage.read(attachment.storage_key)
    nonce, ciphertext = blob[:12], blob[12:]
    return decrypt(ciphertext, nonce, dek)
