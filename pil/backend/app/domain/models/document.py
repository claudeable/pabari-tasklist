from __future__ import annotations

import uuid
from datetime import datetime

from sqlalchemy import CHAR, BigInteger, DateTime, ForeignKey, Integer, String
from sqlalchemy.dialects.postgresql import TSVECTOR, UUID
from sqlalchemy.orm import Mapped, mapped_column

from app.domain.models.base import Base, UUIDPrimaryKeyMixin


class Document(Base, UUIDPrimaryKeyMixin):
    __tablename__ = "documents"

    project_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("projects.id", ondelete="CASCADE"), nullable=False, index=True
    )
    organization_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), nullable=False, index=True)
    # Logical grouping only — never used as a filesystem path (Threat Model §3.4).
    # Validated against an allow-listed character set at the service layer.
    folder_path: Mapped[str] = mapped_column(String(500), nullable=False, default="/")
    name: Mapped[str] = mapped_column(String(255), nullable=False)
    # use_alter: documents <-> document_versions is a circular FK (a document points at
    # its current version; a version points back at its document) — deferring this one
    # via ALTER TABLE lets SQLAlchemy's create_all (used by test fixtures) resolve
    # table creation order; the real migration (0005) does the equivalent by creating
    # document_versions first, then documents, then adding the versions->documents FK
    # separately.
    current_version_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("document_versions.id", use_alter=True, name="fk_documents_current_version_id"),
        nullable=True,
    )
    status: Mapped[str] = mapped_column(String(20), nullable=False, default="draft")
    checked_out_by: Mapped[uuid.UUID | None] = mapped_column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=True)
    checked_out_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    created_by: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=False)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False, server_default="now()")
    deleted_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)


class DocumentVersion(Base, UUIDPrimaryKeyMixin):
    __tablename__ = "document_versions"

    document_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("documents.id", ondelete="CASCADE"), nullable=False, index=True
    )
    version_number: Mapped[int] = mapped_column(Integer, nullable=False)
    # Opaque, server-generated, random storage key — never derived from the client
    # filename (Threat Model §3.4 path-traversal mitigation).
    storage_key: Mapped[str] = mapped_column(String(255), nullable=False, unique=True)
    # Per-version DEK, wrapped by the owning org's KEK — same envelope pattern as chat.
    encrypted_dek: Mapped[str] = mapped_column(String, nullable=False)
    file_hash_sha256: Mapped[str] = mapped_column(CHAR(64), nullable=False)
    size_bytes: Mapped[int] = mapped_column(BigInteger, nullable=False)
    mime_type: Mapped[str] = mapped_column(String(150), nullable=False)
    original_filename: Mapped[str] = mapped_column(String(255), nullable=False)
    scan_status: Mapped[str] = mapped_column(String(20), nullable=False, default="pending")
    uploaded_by: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=False)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False, server_default="now()")


class DocumentSearchIndex(Base):
    """Derived plaintext search index over document/version metadata (name, filename)
    — same resolved tradeoff as message_search_index (Encryption Design doc §8).
    Content-level (in-file) search is out of scope for v1."""

    __tablename__ = "document_search_index"

    document_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("documents.id", ondelete="CASCADE"), primary_key=True
    )
    organization_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), nullable=False, index=True)
    project_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), nullable=False, index=True)
    tsv: Mapped[str] = mapped_column(TSVECTOR, nullable=False)
