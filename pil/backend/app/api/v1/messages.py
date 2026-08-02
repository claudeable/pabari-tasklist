"""Message endpoints (API Specification doc "Channels & Messages")."""

from __future__ import annotations

import base64
import uuid
from datetime import datetime

from fastapi import APIRouter, Depends, File, Form, Query, Request, UploadFile
from fastapi.responses import StreamingResponse
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.attachment_tokens import AttachmentTokenError, issue_attachment_view_token, redeem_attachment_view_token
from app.core.config import Settings, get_settings
from app.core.deps import (
    get_attachment_scoped_session,
    get_channel_scoped_session,
    get_current_claims,
    get_message_scoped_session,
    get_scanner,
    get_storage,
    require_channel_permission,
)
from app.core.errors import NotAuthenticatedError, PermissionDeniedError, RateLimitedError, ResourceNotFoundError
from app.core.rate_limit import RateLimiter
from app.core.security.jwt import AccessTokenClaims
from app.core.ws_manager import publish_message_event
from app.repositories import attachment_repository, channel_repository, message_repository, user_repository
from app.schemas.chat import (
    AttachmentViewUrlResponse,
    MessageAttachmentResponse,
    MessageCreateRequest,
    MessageResponse,
    MessageSearchResponse,
    MessageUpdateRequest,
)
from app.services import attachment_service, chat_service, document_service, notification_service
from app.services.attachment_service import INLINE_VIEWABLE_MIME_TYPES
from app.services.auth_service import resolve_root_secret
from app.services.chat_service import extract_mentions
from app.services.rbac_service import user_has_project_permission

router = APIRouter(tags=["messages"])


def _b64(data: bytes) -> str:
    return base64.b64encode(data).decode()


def _attachment_to_response(attachment) -> MessageAttachmentResponse:
    return MessageAttachmentResponse(
        id=str(attachment.id),
        filename=attachment.original_filename,
        mime_type=attachment.mime_type,
        size_bytes=attachment.size_bytes,
    )


def _to_response(
    channel, settings: Settings, organization_id: uuid.UUID, message, attachment=None
) -> MessageResponse:
    body = chat_service.decrypt_message_body(settings, channel, organization_id, message)
    return MessageResponse(
        id=str(message.id),
        channel_id=str(message.channel_id),
        author_id=str(message.author_id),
        parent_message_id=str(message.parent_message_id) if message.parent_message_id else None,
        body=body,
        mentions=extract_mentions(body),
        edited_at=message.edited_at,
        created_at=message.created_at,
        attachment=_attachment_to_response(attachment) if attachment else None,
    )


@router.get("/channels/{channel_id}/messages", response_model=list[MessageResponse])
async def list_messages(
    channel_id: uuid.UUID,
    request: Request,
    before: datetime | None = Query(default=None),
    limit: int = Query(default=50, le=100),
    session: AsyncSession = Depends(get_channel_scoped_session),
    settings: Settings = Depends(get_settings),
) -> list[MessageResponse]:
    channel = await channel_repository.get_by_id(session, channel_id)
    organization_id = request.state.resolved_organization_id
    messages = await message_repository.list_for_channel(session, channel_id, before=before, limit=limit)
    attachments_by_message = await attachment_repository.get_for_messages(session, [m.id for m in messages])
    return [_to_response(channel, settings, organization_id, m, attachments_by_message.get(m.id)) for m in messages]


@router.post("/channels/{channel_id}/messages", response_model=MessageResponse, status_code=201)
async def create_message(
    channel_id: uuid.UUID,
    body: MessageCreateRequest,
    request: Request,
    claims: AccessTokenClaims = Depends(require_channel_permission("message.send")),
    session: AsyncSession = Depends(get_channel_scoped_session),
    settings: Settings = Depends(get_settings),
) -> MessageResponse:
    organization_id = request.state.resolved_organization_id
    message = await chat_service.post_message(
        session,
        settings,
        channel_id=channel_id,
        organization_id=organization_id,
        author_id=uuid.UUID(claims.sub),
        body=body.body,
        parent_message_id=uuid.UUID(body.parent_message_id) if body.parent_message_id else None,
    )

    channel = await channel_repository.get_by_id(session, channel_id)
    response = _to_response(channel, settings, organization_id, message)

    author = await user_repository.get_by_id(session, uuid.UUID(claims.sub))
    if author is not None:
        if response.mentions:
            await notification_service.notify_mentions(
                session,
                aliases=response.mentions,
                message_id=message.id,
                channel_id=channel_id,
                project_id=channel.project_id,
                organization_id=organization_id,
                author_id=author.id,
            )
        await notification_service.notify_new_message(
            session,
            channel_id=channel_id,
            project_id=channel.project_id,
            message_id=message.id,
            author_id=author.id,
            author_alias=author.alias,
            preview=response.body,
            is_private=channel.is_private,
        )

    # Fan out to any live WS subscribers — only ciphertext+nonce cross the pub/sub bus
    # (Encryption Design doc §8 extended to chat; Redis never sees plaintext).
    await publish_message_event(
        request.app.state.redis,
        channel_id=channel_id,
        message_id=message.id,
        author_id=message.author_id,
        ciphertext_b64=_b64(message.ciphertext),
        nonce_b64=_b64(message.nonce),
        created_at_iso=message.created_at.isoformat(),
    )
    return response


async def _read_upload_capped(file: UploadFile, max_bytes: int) -> bytes:
    data = await file.read(max_bytes + 1)
    if len(data) > max_bytes:
        raise document_service.DocumentValidationError("File exceeds maximum upload size")
    return data


@router.post("/channels/{channel_id}/attachments", response_model=MessageResponse, status_code=201)
async def create_attachment(
    channel_id: uuid.UUID,
    request: Request,
    file: UploadFile = File(...),
    caption: str = Form(default=""),
    claims: AccessTokenClaims = Depends(require_channel_permission("message.send")),
    session: AsyncSession = Depends(get_channel_scoped_session),
    settings: Settings = Depends(get_settings),
    storage=Depends(get_storage),
    scanner=Depends(get_scanner),
) -> MessageResponse:
    limiter = RateLimiter(request.app.state.redis)
    rate_result = await limiter.check(
        f"document-upload:{claims.sub}", limit=settings.document_upload_rate_limit_per_minute, window_seconds=60
    )
    if not rate_result.allowed:
        raise RateLimitedError()

    filename = file.filename or "unnamed"
    data = await _read_upload_capped(file, settings.max_upload_bytes)
    organization_id = request.state.resolved_organization_id

    # A message body can't be empty (MessageCreateRequest.body has min_length=1) — an
    # attachment with no caption still needs *some* text, so it falls back to the
    # filename rather than forcing the sender to type something redundant.
    message = await chat_service.post_message(
        session,
        settings,
        channel_id=channel_id,
        organization_id=organization_id,
        author_id=uuid.UUID(claims.sub),
        body=caption.strip() or f"📎 {filename}",
        parent_message_id=None,
    )

    attachment = await attachment_service.upload_attachment(
        session, settings, storage, scanner,
        message_id=message.id, channel_id=channel_id, organization_id=organization_id,
        filename=filename, mime_type=file.content_type or "application/octet-stream",
        data=data, uploaded_by=uuid.UUID(claims.sub),
    )

    channel = await channel_repository.get_by_id(session, channel_id)
    response = _to_response(channel, settings, organization_id, message, attachment)

    author = await user_repository.get_by_id(session, uuid.UUID(claims.sub))
    if author is not None:
        await notification_service.notify_new_message(
            session,
            channel_id=channel_id,
            project_id=channel.project_id,
            message_id=message.id,
            author_id=author.id,
            author_alias=author.alias,
            preview=response.body,
            is_private=channel.is_private,
        )

    await publish_message_event(
        request.app.state.redis,
        channel_id=channel_id,
        message_id=message.id,
        author_id=message.author_id,
        ciphertext_b64=_b64(message.ciphertext),
        nonce_b64=_b64(message.nonce),
        created_at_iso=message.created_at.isoformat(),
    )
    return response


@router.get("/attachments/{attachment_id}/view-url", response_model=AttachmentViewUrlResponse)
async def get_attachment_view_url(
    attachment_id: uuid.UUID,
    request: Request,
    session: AsyncSession = Depends(get_attachment_scoped_session),
    settings: Settings = Depends(get_settings),
) -> AttachmentViewUrlResponse:
    organization_id = request.state.resolved_organization_id
    root_secret = resolve_root_secret(settings)
    token = issue_attachment_view_token(
        root_secret=root_secret,
        organization_id=organization_id,
        attachment_id=attachment_id,
        ttl_seconds=settings.download_token_ttl_seconds,
    )
    return AttachmentViewUrlResponse(token=token, expires_in=settings.download_token_ttl_seconds)


@router.get("/attachment-downloads/{token}")
async def download_attachment(
    token: str,
    request: Request,
    claims: AccessTokenClaims = Depends(get_current_claims),
    settings: Settings = Depends(get_settings),
    storage=Depends(get_storage),
) -> StreamingResponse:
    root_secret = resolve_root_secret(settings)
    try:
        attachment_id, organization_id = await redeem_attachment_view_token(
            request.app.state.redis, root_secret=root_secret, token=token
        )
    except AttachmentTokenError as exc:
        raise NotAuthenticatedError(str(exc)) from exc

    from app.core.db import tenant_scoped_session

    session_factory = request.app.state.session_factory
    async with tenant_scoped_session(
        session_factory, user_id=claims.sub, organization_id=str(organization_id)
    ) as session:
        attachment = await attachment_repository.get_by_id(session, attachment_id)
        if attachment is None:
            raise ResourceNotFoundError()

        # Token proves authenticity/freshness, not current authorization — re-check
        # live channel membership on every redemption (same rationale as documents'
        # /downloads/{token}, but a channel check here instead of project access,
        # since a private channel/DM needs the narrower check).
        channel = await channel_repository.get_by_id(session, attachment.channel_id)
        if channel is None:
            raise ResourceNotFoundError()
        if channel.is_private and not await channel_repository.is_member(
            session, attachment.channel_id, uuid.UUID(claims.sub)
        ):
            raise PermissionDeniedError()

        plaintext = await attachment_service.get_decrypted_content(
            settings, storage, organization_id=organization_id, attachment=attachment
        )

    disposition = "inline" if attachment.mime_type in INLINE_VIEWABLE_MIME_TYPES else "attachment"

    async def _stream():
        yield plaintext

    return StreamingResponse(
        _stream(),
        media_type=attachment.mime_type,
        headers={
            "Content-Disposition": f'{disposition}; filename="{_safe_filename(attachment.original_filename)}"',
            "X-Content-Type-Options": "nosniff",
        },
    )


def _safe_filename(filename: str) -> str:
    return "".join(c for c in filename if c.isalnum() or c in " ._-") or "attachment"


@router.patch("/messages/{message_id}", response_model=MessageResponse)
async def edit_message(
    message_id: uuid.UUID,
    body: MessageUpdateRequest,
    request: Request,
    claims: AccessTokenClaims = Depends(get_current_claims),
    session: AsyncSession = Depends(get_message_scoped_session),
    settings: Settings = Depends(get_settings),
) -> MessageResponse:
    # Author-only check happens inside chat_service.edit_message — no role in
    # _PROJECT_ROLE_PERMISSIONS grants "edit someone else's message" (see rbac_service
    # module docstring); this is intentionally not a require_*_permission() gate.
    organization_id = request.state.resolved_organization_id
    channel_id = request.state.resolved_channel_id
    await chat_service.edit_message(
        session,
        settings,
        channel_id=channel_id,
        organization_id=organization_id,
        message_id=message_id,
        editor_id=uuid.UUID(claims.sub),
        new_body=body.body,
    )
    message = await message_repository.get_by_id(session, message_id)
    channel = await channel_repository.get_by_id(session, channel_id)
    return _to_response(channel, settings, organization_id, message)


@router.delete("/messages/{message_id}", status_code=204)
async def delete_message(
    message_id: uuid.UUID,
    request: Request,
    claims: AccessTokenClaims = Depends(get_current_claims),
    session: AsyncSession = Depends(get_message_scoped_session),
) -> None:
    organization_id = request.state.resolved_organization_id
    project_id = request.state.resolved_project_id
    channel_id = request.state.resolved_channel_id
    user_id = uuid.UUID(claims.sub)

    can_delete_any = await user_has_project_permission(
        session, user_id=user_id, project_id=project_id, organization_id=organization_id, permission_code="message.delete.any"
    )
    await chat_service.delete_message(
        session,
        channel_id=channel_id,
        message_id=message_id,
        deleter_id=user_id,
        deleter_can_delete_any=can_delete_any,
    )


@router.post("/messages/{message_id}/read", status_code=204)
async def mark_read(
    message_id: uuid.UUID,
    claims: AccessTokenClaims = Depends(get_current_claims),
    session: AsyncSession = Depends(get_message_scoped_session),
) -> None:
    await chat_service.mark_read(session, message_id=message_id, user_id=uuid.UUID(claims.sub))


@router.get("/channels/{channel_id}/search", response_model=MessageSearchResponse)
async def search_channel(
    channel_id: uuid.UUID,
    q: str = Query(min_length=1, max_length=200),
    session: AsyncSession = Depends(get_channel_scoped_session),
) -> MessageSearchResponse:
    message_ids = await chat_service.search_channel(session, channel_id=channel_id, query=q)
    return MessageSearchResponse(message_ids=[str(m) for m in message_ids])
