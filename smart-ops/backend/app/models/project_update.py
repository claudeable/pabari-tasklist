import uuid
from datetime import datetime
from typing import Optional

from sqlalchemy import DateTime, ForeignKey, LargeBinary, String, Text, func
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base_class import Base, UUIDMixin


class ProjectUpdate(UUIDMixin, Base):
    __tablename__ = "project_updates"

    project_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("projects.id", ondelete="CASCADE"), nullable=False
    )
    user_id: Mapped[Optional[uuid.UUID]] = mapped_column(
        UUID(as_uuid=True), ForeignKey("users.id", ondelete="SET NULL"), nullable=True
    )
    body: Mapped[str] = mapped_column(Text, nullable=False)
    source: Mapped[str] = mapped_column(String(50), nullable=False, default="internal")
    email_from: Mapped[Optional[str]] = mapped_column(String(512), nullable=True)
    email_subject: Mapped[Optional[str]] = mapped_column(String(512), nullable=True)
    posted_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    status: Mapped[str] = mapped_column(String(20), nullable=False, default="open")
    parent_update_id: Mapped[Optional[uuid.UUID]] = mapped_column(
        UUID(as_uuid=True), ForeignKey("project_updates.id", ondelete="SET NULL"), nullable=True
    )

    project: Mapped["Project"] = relationship()
    user: Mapped[Optional["User"]] = relationship()
    attachments: Mapped[list["ProjectUpdateAttachment"]] = relationship(
        back_populates="update", cascade="all, delete-orphan"
    )
    parent: Mapped[Optional["ProjectUpdate"]] = relationship(
        "ProjectUpdate", remote_side="ProjectUpdate.id", foreign_keys=[parent_update_id]
    )
    comments: Mapped[list["ProjectUpdateComment"]] = relationship(
        back_populates="update", cascade="all, delete-orphan", order_by="ProjectUpdateComment.created_at"
    )


class ProjectUpdateComment(UUIDMixin, Base):
    __tablename__ = "project_update_comments"

    update_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("project_updates.id", ondelete="CASCADE"), nullable=False
    )
    user_id: Mapped[Optional[uuid.UUID]] = mapped_column(
        UUID(as_uuid=True), ForeignKey("users.id", ondelete="SET NULL"), nullable=True
    )
    body: Mapped[str] = mapped_column(Text, nullable=False)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())

    update: Mapped["ProjectUpdate"] = relationship(back_populates="comments")
    user: Mapped[Optional["User"]] = relationship()


class ProjectUpdateAttachment(UUIDMixin, Base):
    __tablename__ = "project_update_attachments"

    update_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("project_updates.id", ondelete="CASCADE"), nullable=False
    )
    filename: Mapped[str] = mapped_column(String(512), nullable=False)
    file_data: Mapped[bytes] = mapped_column(LargeBinary, nullable=False)
    file_mime_type: Mapped[str] = mapped_column(String(255), nullable=False, default="application/octet-stream")
    file_size: Mapped[Optional[int]] = mapped_column(nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())

    update: Mapped["ProjectUpdate"] = relationship(back_populates="attachments")
