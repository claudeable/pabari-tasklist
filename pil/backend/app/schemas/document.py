from __future__ import annotations

from datetime import datetime

from pydantic import BaseModel, ConfigDict


class DocumentResponse(BaseModel):
    model_config = ConfigDict(extra="forbid", from_attributes=True)

    id: str
    project_id: str
    folder_path: str
    name: str
    status: str
    checked_out_by: str | None
    created_at: datetime


class DocumentVersionResponse(BaseModel):
    model_config = ConfigDict(extra="forbid")

    id: str
    document_id: str
    version_number: int
    file_hash_sha256: str
    size_bytes: int
    mime_type: str
    original_filename: str
    scan_status: str
    created_at: datetime


class DownloadUrlResponse(BaseModel):
    model_config = ConfigDict(extra="forbid")

    token: str
    expires_in: int


class DocumentSearchResponse(BaseModel):
    model_config = ConfigDict(extra="forbid")

    document_ids: list[str]
