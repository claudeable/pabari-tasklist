from __future__ import annotations

import uuid
from datetime import datetime

from sqlalchemy import Boolean, DateTime, ForeignKey, Integer, String
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.domain.enums import SystemRole, UserStatus
from app.domain.models.base import Base, TimestampMixin, UUIDPrimaryKeyMixin


class User(Base, UUIDPrimaryKeyMixin, TimestampMixin):
    """Identity is alias-only — no real name or email is ever stored (Authentication
    Design doc §1). Accounts are created exclusively by an admin or the bootstrap
    script; there is no self-registration endpoint anywhere in the API."""

    __tablename__ = "users"

    alias: Mapped[str] = mapped_column(String(32), unique=True, nullable=False, index=True)
    # pabari_email links this alias account to a Pabari ERP user for SSO.
    # Null for accounts that have no corresponding Pabari ERP account.
    pabari_email: Mapped[str | None] = mapped_column(String(255), unique=True, nullable=True, index=True)
    password_hash: Mapped[str] = mapped_column(String, nullable=False)
    totp_secret_encrypted: Mapped[str | None] = mapped_column(String, nullable=True)
    totp_last_step: Mapped[int | None] = mapped_column(Integer, nullable=True)
    mfa_enabled: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False)
    status: Mapped[UserStatus] = mapped_column(
        String(20), nullable=False, default=UserStatus.active.value
    )
    failed_login_count: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    locked_until: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    system_role: Mapped[SystemRole] = mapped_column(
        String(30), nullable=False, default=SystemRole.member.value
    )
    must_change_password: Mapped[bool] = mapped_column(Boolean, nullable=False, default=True)

    devices: Mapped[list[Device]] = relationship(back_populates="user")
    sessions: Mapped[list[Session]] = relationship(back_populates="user")


class PasswordHistory(Base, UUIDPrimaryKeyMixin):
    __tablename__ = "password_history"

    user_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True
    )
    password_hash: Mapped[str] = mapped_column(String, nullable=False)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False, server_default="now()")


class WebAuthnCredential(Base, UUIDPrimaryKeyMixin):
    """WebAuthn/FIDO2 credentials for privileged roles (Authentication Design doc §3.1)."""

    __tablename__ = "webauthn_credentials"

    user_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True
    )
    credential_id: Mapped[str] = mapped_column(String, unique=True, nullable=False)
    public_key: Mapped[str] = mapped_column(String, nullable=False)
    sign_count: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    transports: Mapped[str | None] = mapped_column(String, nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False, server_default="now()")


class BackupCode(Base, UUIDPrimaryKeyMixin):
    """Single-use MFA backup codes (Authentication Design doc §3)."""

    __tablename__ = "backup_codes"

    user_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True
    )
    code_hash: Mapped[str] = mapped_column(String, nullable=False)
    used_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False, server_default="now()")


class Device(Base, UUIDPrimaryKeyMixin):
    __tablename__ = "devices"

    user_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True
    )
    device_fingerprint: Mapped[str] = mapped_column(String, nullable=False)
    device_name: Mapped[str | None] = mapped_column(String(120), nullable=True)
    trusted: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False)
    first_seen_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False, server_default="now()")
    last_seen_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False, server_default="now()")
    revoked_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)

    user: Mapped[User] = relationship(back_populates="devices")
    sessions: Mapped[list[Session]] = relationship(back_populates="device")


class Session(Base, UUIDPrimaryKeyMixin):
    """Refresh-token session. refresh_token_hash is never the raw token (Authentication
    Design doc §5); rotated_from forms a chain used to detect refresh-token reuse."""

    __tablename__ = "sessions"

    user_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True
    )
    device_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("devices.id", ondelete="CASCADE"), nullable=False, index=True
    )
    refresh_token_hash: Mapped[str] = mapped_column(String, nullable=False, unique=True)
    ip_address: Mapped[str] = mapped_column(String(45), nullable=False)
    user_agent: Mapped[str | None] = mapped_column(String, nullable=True)
    issued_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False, server_default="now()")
    expires_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)
    revoked_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    rotated_from: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True), ForeignKey("sessions.id"), nullable=True
    )

    user: Mapped[User] = relationship(back_populates="sessions")
    device: Mapped[Device] = relationship(back_populates="sessions")
