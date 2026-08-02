"""Document endpoints (API Specification doc "Documents")."""

from __future__ import annotations

import uuid

from fastapi import APIRouter, Depends, File, Form, Query, Request, UploadFile
from fastapi.responses import StreamingResponse
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import Settings, get_settings
from app.core.deps import (
    get_current_claims,
    get_document_scoped_session,
    get_project_scoped_session,
    get_scanner,
    get_storage,
    require_document_permission,
    require_project_permission,
)
from app.core.download_tokens import DownloadTokenError, issue_download_token, redeem_download_token
from app.core.errors import NotAuthenticatedError, PermissionDeniedError, RateLimitedError, ResourceNotFoundError
from app.core.rate_limit import RateLimiter
from app.core.security.jwt import AccessTokenClaims
from app.repositories import document_repository
from app.schemas.document import DocumentResponse, DocumentSearchResponse, DocumentVersionResponse, DownloadUrlResponse
from app.services import document_service
from app.services.auth_service import resolve_root_secret
from app.services.rbac_service import user_has_project_permission

router = APIRouter(tags=["documents"])


async def _read_upload_capped(file: UploadFile, max_bytes: int) -> bytes:
    """Reads at most max_bytes+1 so an oversized upload is rejected without buffering
    an attacker-controlled amount of data into memory first."""
    data = await file.read(max_bytes + 1)
    if len(data) > max_bytes:
        raise document_service.DocumentValidationError("File exceeds maximum upload size")
    return data


def _doc_to_response(document) -> DocumentResponse:
    return DocumentResponse(
        id=str(document.id),
        project_id=str(document.project_id),
        folder_path=document.folder_path,
        name=document.name,
        status=document.status,
        checked_out_by=str(document.checked_out_by) if document.checked_out_by else None,
        created_at=document.created_at,
    )


def _version_to_response(version) -> DocumentVersionResponse:
    return DocumentVersionResponse(
        id=str(version.id),
        document_id=str(version.document_id),
        version_number=version.version_number,
        file_hash_sha256=version.file_hash_sha256,
        size_bytes=version.size_bytes,
        mime_type=version.mime_type,
        original_filename=version.original_filename,
        scan_status=version.scan_status,
        created_at=version.created_at,
    )


@router.post("/projects/{project_id}/documents", response_model=DocumentResponse, status_code=201)
async def upload_document(
    project_id: uuid.UUID,
    request: Request,
    file: UploadFile = File(...),
    name: str = Form(...),
    folder_path: str = Form(default="/"),
    claims: AccessTokenClaims = Depends(require_project_permission("document.upload")),
    session: AsyncSession = Depends(get_project_scoped_session),
    settings: Settings = Depends(get_settings),
    storage=Depends(get_storage),
    scanner=Depends(get_scanner),
) -> DocumentResponse:
    limiter = RateLimiter(request.app.state.redis)
    rate_result = await limiter.check(
        f"document-upload:{claims.sub}", limit=settings.document_upload_rate_limit_per_minute, window_seconds=60
    )
    if not rate_result.allowed:
        raise RateLimitedError()

    data = await _read_upload_capped(file, settings.max_upload_bytes)
    organization_id = request.state.resolved_organization_id

    document, _version = await document_service.upload_document(
        session, settings, storage, scanner,
        project_id=project_id, organization_id=organization_id, folder_path=folder_path, name=name,
        filename=file.filename or "unnamed", mime_type=file.content_type or "application/octet-stream",
        data=data, uploaded_by=uuid.UUID(claims.sub),
    )
    return _doc_to_response(document)


@router.get("/projects/{project_id}/documents", response_model=list[DocumentResponse])
async def list_documents(
    project_id: uuid.UUID,
    folder: str | None = Query(default=None),
    session: AsyncSession = Depends(get_project_scoped_session),
) -> list[DocumentResponse]:
    documents = await document_repository.list_for_project(session, project_id, folder_path=folder)
    return [_doc_to_response(d) for d in documents]


@router.get("/projects/{project_id}/documents/search", response_model=DocumentSearchResponse)
async def search_documents(
    project_id: uuid.UUID,
    q: str = Query(min_length=1, max_length=200),
    session: AsyncSession = Depends(get_project_scoped_session),
) -> DocumentSearchResponse:
    ids = await document_repository.search_project(session, project_id=project_id, query=q)
    return DocumentSearchResponse(document_ids=[str(i) for i in ids])


@router.get("/documents/{document_id}", response_model=DocumentResponse)
async def get_document(
    document_id: uuid.UUID, session: AsyncSession = Depends(get_document_scoped_session)
) -> DocumentResponse:
    document = await document_repository.get_by_id(session, document_id)
    if document is None:
        raise ResourceNotFoundError()
    return _doc_to_response(document)


@router.get("/documents/{document_id}/versions", response_model=list[DocumentVersionResponse])
async def list_versions(
    document_id: uuid.UUID, session: AsyncSession = Depends(get_document_scoped_session)
) -> list[DocumentVersionResponse]:
    versions = await document_repository.list_versions(session, document_id)
    return [_version_to_response(v) for v in versions]


@router.post("/documents/{document_id}/versions", response_model=DocumentVersionResponse, status_code=201)
async def upload_version(
    document_id: uuid.UUID,
    request: Request,
    file: UploadFile = File(...),
    claims: AccessTokenClaims = Depends(require_document_permission("document.upload_version")),
    session: AsyncSession = Depends(get_document_scoped_session),
    settings: Settings = Depends(get_settings),
    storage=Depends(get_storage),
    scanner=Depends(get_scanner),
) -> DocumentVersionResponse:
    data = await _read_upload_capped(file, settings.max_upload_bytes)
    organization_id = request.state.resolved_organization_id

    version = await document_service.upload_new_version(
        session, settings, storage, scanner,
        document_id=document_id, organization_id=organization_id,
        filename=file.filename or "unnamed", mime_type=file.content_type or "application/octet-stream",
        data=data, uploaded_by=uuid.UUID(claims.sub),
    )
    return _version_to_response(version)


@router.get("/documents/{document_id}/download-url", response_model=DownloadUrlResponse)
async def get_download_url(
    document_id: uuid.UUID,
    request: Request,
    session: AsyncSession = Depends(get_document_scoped_session),
    settings: Settings = Depends(get_settings),
) -> DownloadUrlResponse:
    document = await document_repository.get_by_id(session, document_id)
    if document is None or document.current_version_id is None:
        raise ResourceNotFoundError()

    organization_id = request.state.resolved_organization_id
    root_secret = resolve_root_secret(settings)
    token = issue_download_token(
        root_secret=root_secret,
        organization_id=organization_id,
        document_id=document_id,
        version_id=document.current_version_id,
        ttl_seconds=settings.download_token_ttl_seconds,
    )
    return DownloadUrlResponse(token=token, expires_in=settings.download_token_ttl_seconds)


@router.get("/downloads/{token}")
async def download(
    token: str,
    request: Request,
    claims: AccessTokenClaims = Depends(get_current_claims),
    settings: Settings = Depends(get_settings),
    storage=Depends(get_storage),
) -> StreamingResponse:
    root_secret = resolve_root_secret(settings)
    try:
        document_id, version_id, organization_id = await redeem_download_token(
            request.app.state.redis, root_secret=root_secret, token=token
        )
    except DownloadTokenError as exc:
        raise NotAuthenticatedError(str(exc)) from exc

    # The token proves authenticity/freshness, NOT current authorization — re-verify
    # against live membership state on every redemption (Encryption Design doc §7).
    from app.core.db import tenant_scoped_session

    session_factory = request.app.state.session_factory
    async with tenant_scoped_session(
        session_factory, user_id=claims.sub, organization_id=str(organization_id)
    ) as session:
        from app.services.rbac_service import user_can_access_project

        document = await document_repository.get_by_id(session, document_id)
        if document is None:
            raise ResourceNotFoundError()
        if not await user_can_access_project(
            session, user_id=uuid.UUID(claims.sub), project_id=document.project_id, organization_id=organization_id
        ):
            raise PermissionDeniedError()

        version = await document_repository.get_version(session, version_id)
        if version is None or version.document_id != document_id:
            raise ResourceNotFoundError()

        plaintext = await document_service.get_decrypted_content(
            settings, storage, organization_id=organization_id, version=version
        )

    async def _stream():
        yield plaintext

    return StreamingResponse(
        _stream(),
        media_type=version.mime_type,
        headers={
            "Content-Disposition": f'attachment; filename="{_safe_content_disposition_filename(version.original_filename)}"',
            "X-Content-Type-Options": "nosniff",
        },
    )


def _safe_content_disposition_filename(filename: str) -> str:
    # Strips characters that could break out of the quoted filename parameter (header
    # injection) — belt-and-suspenders alongside the length/charset checks already
    # applied at upload time in document_service.validate_upload.
    return "".join(c for c in filename if c.isalnum() or c in " ._-") or "download"


@router.post("/documents/{document_id}/submit-for-approval", status_code=204)
async def submit_for_approval(
    document_id: uuid.UUID,
    claims: AccessTokenClaims = Depends(require_document_permission("document.upload")),
    session: AsyncSession = Depends(get_document_scoped_session),
) -> None:
    await document_service.submit_for_approval(session, document_id=document_id)


@router.post("/documents/{document_id}/checkout", status_code=204)
async def checkout(
    document_id: uuid.UUID,
    claims: AccessTokenClaims = Depends(require_document_permission("document.checkout")),
    session: AsyncSession = Depends(get_document_scoped_session),
) -> None:
    await document_service.checkout(session, document_id=document_id, user_id=uuid.UUID(claims.sub))


@router.post("/documents/{document_id}/checkin", status_code=204)
async def checkin(
    document_id: uuid.UUID,
    request: Request,
    claims: AccessTokenClaims = Depends(get_current_claims),
    session: AsyncSession = Depends(get_document_scoped_session),
) -> None:
    organization_id = request.state.resolved_organization_id
    project_id = request.state.resolved_project_id
    can_override = await user_has_project_permission(
        session, user_id=uuid.UUID(claims.sub), project_id=project_id, organization_id=organization_id,
        permission_code="document.checkout.override",
    )
    await document_service.checkin(session, document_id=document_id, user_id=uuid.UUID(claims.sub), can_override=can_override)


@router.post("/documents/{document_id}/approve", status_code=204)
async def approve(
    document_id: uuid.UUID,
    claims: AccessTokenClaims = Depends(require_document_permission("document.approve")),
    session: AsyncSession = Depends(get_document_scoped_session),
) -> None:
    await document_service.approve(session, document_id=document_id)


@router.post("/documents/{document_id}/reject", status_code=204)
async def reject(
    document_id: uuid.UUID,
    claims: AccessTokenClaims = Depends(require_document_permission("document.approve")),
    session: AsyncSession = Depends(get_document_scoped_session),
) -> None:
    await document_service.reject(session, document_id=document_id)


@router.delete("/documents/{document_id}", status_code=204)
async def delete_document(
    document_id: uuid.UUID,
    claims: AccessTokenClaims = Depends(require_document_permission("document.delete")),
    session: AsyncSession = Depends(get_document_scoped_session),
) -> None:
    await document_service.delete_document(session, document_id=document_id)
