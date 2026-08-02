from __future__ import annotations

import uuid
from datetime import UTC, datetime

from sqlalchemy import select, text
from sqlalchemy.ext.asyncio import AsyncSession

from app.domain.models.document import Document, DocumentVersion


async def get_organization_id_for_document(session: AsyncSession, document_id: uuid.UUID) -> uuid.UUID | None:
    """SECURITY DEFINER-backed lookup — see migration 0005 and the equivalent
    project/channel/message functions for why this can't be a direct SELECT."""
    result = await session.execute(
        text("SELECT get_document_organization_id(:document_id) AS org_id").bindparams(document_id=document_id)
    )
    row = result.first()
    return row.org_id if row and row.org_id is not None else None


async def create_document(
    session: AsyncSession,
    *,
    project_id: uuid.UUID,
    organization_id: uuid.UUID,
    folder_path: str,
    name: str,
    created_by: uuid.UUID,
) -> Document:
    document = Document(
        project_id=project_id,
        organization_id=organization_id,
        folder_path=folder_path,
        name=name,
        created_by=created_by,
    )
    session.add(document)
    await session.flush()
    return document


async def get_by_id(session: AsyncSession, document_id: uuid.UUID) -> Document | None:
    result = await session.execute(
        select(Document).where(Document.id == document_id, Document.deleted_at.is_(None))
    )
    return result.scalar_one_or_none()


async def get_by_id_for_update(session: AsyncSession, document_id: uuid.UUID) -> Document | None:
    """Row-locked read — serializes concurrent approve/reject calls on the same
    document (Pentest Checklist §5: "Race condition: simultaneous approval/rejection
    of the same document"), same pattern as task status transitions."""
    result = await session.execute(
        select(Document).where(Document.id == document_id, Document.deleted_at.is_(None)).with_for_update()
    )
    return result.scalar_one_or_none()


async def soft_delete(session: AsyncSession, document_id: uuid.UUID) -> None:
    document = await get_by_id(session, document_id)
    if document is not None:
        document.deleted_at = datetime.now(UTC)


async def list_for_project(session: AsyncSession, project_id: uuid.UUID, *, folder_path: str | None = None) -> list[Document]:
    query = select(Document).where(Document.project_id == project_id, Document.deleted_at.is_(None))
    if folder_path is not None:
        query = query.where(Document.folder_path == folder_path)
    result = await session.execute(query)
    return list(result.scalars().all())


async def create_version(
    session: AsyncSession,
    *,
    document_id: uuid.UUID,
    version_number: int,
    storage_key: str,
    encrypted_dek: str,
    file_hash_sha256: str,
    size_bytes: int,
    mime_type: str,
    original_filename: str,
    uploaded_by: uuid.UUID,
) -> DocumentVersion:
    version = DocumentVersion(
        document_id=document_id,
        version_number=version_number,
        storage_key=storage_key,
        encrypted_dek=encrypted_dek,
        file_hash_sha256=file_hash_sha256,
        size_bytes=size_bytes,
        mime_type=mime_type,
        original_filename=original_filename,
        uploaded_by=uploaded_by,
    )
    session.add(version)
    await session.flush()
    return version


async def get_version(session: AsyncSession, version_id: uuid.UUID) -> DocumentVersion | None:
    result = await session.execute(select(DocumentVersion).where(DocumentVersion.id == version_id))
    return result.scalar_one_or_none()


async def list_versions(session: AsyncSession, document_id: uuid.UUID) -> list[DocumentVersion]:
    result = await session.execute(
        select(DocumentVersion)
        .where(DocumentVersion.document_id == document_id)
        .order_by(DocumentVersion.version_number.desc())
    )
    return list(result.scalars().all())


async def next_version_number(session: AsyncSession, document_id: uuid.UUID) -> int:
    result = await session.execute(
        select(DocumentVersion.version_number)
        .where(DocumentVersion.document_id == document_id)
        .order_by(DocumentVersion.version_number.desc())
        .limit(1)
    )
    latest = result.scalar_one_or_none()
    return (latest or 0) + 1


async def upsert_search_index(
    session: AsyncSession, *, document_id: uuid.UUID, organization_id: uuid.UUID, project_id: uuid.UUID, plaintext: str
) -> None:
    await session.execute(
        text(
            """
            INSERT INTO document_search_index (document_id, organization_id, project_id, tsv)
            VALUES (:document_id, :organization_id, :project_id, to_tsvector('english', :plaintext))
            ON CONFLICT (document_id) DO UPDATE SET tsv = EXCLUDED.tsv
            """
        ).bindparams(document_id=document_id, organization_id=organization_id, project_id=project_id, plaintext=plaintext)
    )


async def get_total_storage_usage(session: AsyncSession) -> int:
    """Admin-only cross-tenant aggregate (API Spec "GET /admin/storage/usage") — goes
    through a SECURITY DEFINER function (migration 0007) because `documents`/
    `document_versions` carry FORCE ROW LEVEL SECURITY and an admin request has no
    single org's app.current_org_id set. The function returns a scalar total only —
    no per-document detail — deliberately narrow, same reasoning as the org/project
    bootstrap-lookup functions. Authorization is enforced at the API layer before this
    is ever called, not by the function itself."""
    result = await session.execute(text("SELECT get_total_storage_usage_bytes() AS total"))
    row = result.first()
    return int(row.total) if row and row.total is not None else 0


async def get_storage_usage_by_org(session: AsyncSession) -> list[tuple[uuid.UUID, int]]:
    result = await session.execute(
        text("SELECT organization_id, total_bytes FROM get_storage_usage_by_org()")
    )
    return [(row.organization_id, int(row.total_bytes)) for row in result.all()]


async def search_project(session: AsyncSession, *, project_id: uuid.UUID, query: str, limit: int = 20) -> list[uuid.UUID]:
    result = await session.execute(
        text(
            """
            SELECT document_id FROM document_search_index
            WHERE project_id = :project_id AND tsv @@ plainto_tsquery('english', :query)
            ORDER BY ts_rank(tsv, plainto_tsquery('english', :query)) DESC
            LIMIT :limit
            """
        ).bindparams(project_id=project_id, query=query, limit=limit)
    )
    return [row.document_id for row in result.all()]
