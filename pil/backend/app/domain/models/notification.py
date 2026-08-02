from __future__ import annotations

import uuid
from datetime import UTC, datetime

from sqlalchemy import DateTime, ForeignKey, String
from sqlalchemy.dialects.postgresql import JSONB, UUID
from sqlalchemy.orm import Mapped, mapped_column

from app.domain.models.base import Base, UUIDPrimaryKeyMixin


class Notification(Base, UUIDPrimaryKeyMixin):
    """In-app only — no email/SMS integration exists anywhere in this system by
    design (project scope: no third-party services)."""

    __tablename__ = "notifications"

    recipient_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True
    )
    type: Mapped[str] = mapped_column(String(50), nullable=False)
    payload: Mapped[dict] = mapped_column(JSONB, nullable=False)
    read_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    # Client-side default (not just server_default) is required here specifically:
    # a notification's recipient is routinely a DIFFERENT user than whoever's
    # session is doing the INSERT (that's the entire point of a notification).
    # With only a server_default, SQLAlchemy appends `RETURNING created_at` to read
    # the generated value back — but under RLS, RETURNING re-applies the SELECT
    # policy to the just-inserted row, which the inserting user fails (they can't
    # SELECT someone else's notification), so the whole INSERT gets rejected even
    # though the actual INSERT policy permits it. Setting the value client-side
    # avoids needing RETURNING for this column at all.
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False, default=lambda: datetime.now(UTC), server_default="now()"
    )
