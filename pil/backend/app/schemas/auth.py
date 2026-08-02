from __future__ import annotations

from pydantic import BaseModel, ConfigDict, Field

_ALIAS_PATTERN = r"^[A-Za-z][A-Za-z0-9-]{1,30}[A-Za-z0-9]$"


class LoginRequest(BaseModel):
    model_config = ConfigDict(extra="forbid")

    alias: str = Field(min_length=3, max_length=32, pattern=_ALIAS_PATTERN)
    password: str = Field(min_length=1, max_length=256)
    device_fingerprint: str = Field(min_length=8, max_length=256)
    device_name: str | None = Field(default=None, max_length=120)


class LoginResult(BaseModel):
    """Discriminated by `status`: exactly one of the optional fields is populated,
    matching which is determined by `status` — never both tokens and a challenge."""

    model_config = ConfigDict(extra="forbid")

    status: str  # "authenticated" | "mfa_required" | "mfa_enrollment_required" | "password_change_required"
    challenge_token: str | None = None
    access_token: str | None = None
    expires_in: int | None = None


class MfaVerifyRequest(BaseModel):
    model_config = ConfigDict(extra="forbid")

    challenge_token: str
    totp_code: str = Field(min_length=6, max_length=6, pattern=r"^\d{6}$")
    device_fingerprint: str = Field(min_length=8, max_length=256)
    device_name: str | None = Field(default=None, max_length=120)


class TokenResponse(BaseModel):
    model_config = ConfigDict(extra="forbid")

    access_token: str
    token_type: str = "bearer"
    expires_in: int


class PasswordChangeRequest(BaseModel):
    model_config = ConfigDict(extra="forbid")

    current_password: str = Field(min_length=1, max_length=256)
    new_password: str = Field(min_length=8, max_length=256)


class MfaEnrollResponse(BaseModel):
    model_config = ConfigDict(extra="forbid")

    provisioning_uri: str
    secret: str


class MfaEnrollConfirmRequest(BaseModel):
    model_config = ConfigDict(extra="forbid")

    # The un-persisted secret from /mfa/enroll, echoed back on confirm — must travel in
    # the request body, never as a query parameter (which would land in proxy/access
    # logs and browser history; Pentest Checklist §9 "Information Disclosure").
    secret: str
    totp_code: str = Field(min_length=6, max_length=6, pattern=r"^\d{6}$")


class MfaEnrollConfirmResponse(BaseModel):
    model_config = ConfigDict(extra="forbid")

    backup_codes: list[str]
