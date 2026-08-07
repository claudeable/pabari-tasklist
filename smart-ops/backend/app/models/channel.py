import uuid
from datetime import datetime
from typing import Optional

from sqlalchemy import Boolean, DateTime, ForeignKey, String, Text, UniqueConstraint, func
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base_class import Base, UUIDMixin


class Channel(UUIDMixin, Base):
    __tablename__ = "channels"

    project_id: Mapped[Optional[uuid.UUID]] = mapped_column(
        UUID(as_uuid=True), ForeignKey("projects.id", ondelete="CASCADE"), nullable=True
    )
    name: Mapped[str] = mapped_column(String(255), nullable=False)
    is_direct: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False)
    is_group: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False)
    user_a_id: Mapped[Optional[uuid.UUID]] = mapped_column(
        UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), nullable=True
    )
    user_b_id: Mapped[Optional[uuid.UUID]] = mapped_column(
        UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), nullable=True
    )
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())

    project: Mapped[Optional["Project"]] = relationship()
    user_a: Mapped[Optional["User"]] = relationship(foreign_keys=[user_a_id])
    user_b: Mapped[Optional["User"]] = relationship(foreign_keys=[user_b_id])
    messages: Mapped[list["Message"]] = relationship(
        back_populates="channel", cascade="all, delete-orphan"
    )
    members: Mapped[list["ChannelMember"]] = relationship(
        back_populates="channel", cascade="all, delete-orphan"
    )


class ChannelMember(UUIDMixin, Base):
    __tablename__ = "channel_members"
    __table_args__ = (UniqueConstraint("channel_id", "user_id", name="uq_channel_member"),)

    channel_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("channels.id", ondelete="CASCADE"), nullable=False
    )
    user_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), nullable=False
    )
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())

    channel: Mapped["Channel"] = relationship(back_populates="members")
    user: Mapped["User"] = relationship()


class Message(UUIDMixin, Base):
    __tablename__ = "messages"

    channel_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("channels.id", ondelete="CASCADE"), nullable=False
    )
    user_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), nullable=False
    )
    body: Mapped[str] = mapped_column(Text, nullable=False)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())

    channel: Mapped["Channel"] = relationship(back_populates="messages")
    user: Mapped["User"] = relationship()

    @property
    def user_name(self) -> Optional[str]:
        return self.user.full_name if self.user else None
