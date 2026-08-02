from __future__ import annotations

import uuid
from datetime import datetime

from sqlalchemy import CHAR, BigInteger, DateTime, ForeignKey, String
from sqlalchemy.dialects.postgresql import INET, JSONB, UUID
from sqlalchemy.orm import Mapped, mapped_column

from app.domain.models.base import Base, UUIDPrimaryKeyMixin

GENESIS_HASH = "0" * 64


class SecurityEvent(Base, UUIDPrimaryKeyMixin):
    """Tamper-evident, hash-chained audit log (Database Design doc §3).

    The application DB role has INSERT/SELECT only on this table (no UPDATE/DELETE —
    enforced by a GRANT/REVOKE in the migration, not by application logic alone).
    Rows are written exclusively through services/security_event_service.py, which
    computes row_hash under a row-locking transaction to serialize concurrent writers.
    """

    __tablename__ = "security_events"

    user_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True), ForeignKey("users.id"), nullable=True, index=True
    )
    organization_id: Mapped[uuid.UUID | None] = mapped_column(UUID(as_uuid=True), nullable=True)
    event_type: Mapped[str] = mapped_column(String(60), nullable=False, index=True)
    severity: Mapped[str] = mapped_column(String(20), nullable=False, default="info")
    ip_address: Mapped[str | None] = mapped_column(INET, nullable=True)
    metadata_: Mapped[dict | None] = mapped_column("metadata", JSONB, nullable=True)

    seq: Mapped[int] = mapped_column(BigInteger, nullable=False, unique=True)
    prev_hash: Mapped[str] = mapped_column(CHAR(64), nullable=False)
    row_hash: Mapped[str] = mapped_column(CHAR(64), nullable=False)

    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False, server_default="now()")
