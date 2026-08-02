import os
from functools import lru_cache
from pathlib import Path

from pydantic import Field, field_validator
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    """Application configuration, loaded from environment variables / secret files.

    Secrets are read from *_FILE paths when set (Docker secrets convention) so that
    literal secret values never need to appear in the environment or in compose files.
    """

    model_config = SettingsConfigDict(env_file=".env", extra="ignore")

    environment: str = Field(default="development")  # development | test | production
    debug: bool = Field(default=False)

    # Networking / CORS
    allowed_origins: list[str] = Field(default_factory=lambda: ["http://localhost:3000"])

    # "strict" is correct whenever frontend and backend share a registrable domain
    # (the normal same-site deployment this app is designed for — Deployment &
    # Hardening Guide §3). Split-domain deployments (e.g. two separate Railway/
    # Vercel subdomains, which are cross-site to the browser even over HTTPS) need
    # "none" or the browser will simply never send the refresh/CSRF cookies at all
    # and login will silently fail. CSRF protection in that case relies on the
    # explicit X-CSRF-Token double-submit check (CSRFMiddleware), not SameSite.
    cookie_samesite: str = Field(default="strict")

    # Database
    database_url: str = Field(...)

    # Redis
    redis_url: str = Field(default="redis://redis:6379/0")

    # Auth / crypto secrets — provided as file paths in production (Docker secrets)
    jwt_private_key_path: str | None = None
    jwt_public_key_path: str | None = None
    jwt_private_key: str | None = None
    jwt_public_key: str | None = None
    jwt_issuer: str = "scv"
    jwt_access_ttl_seconds: int = 15 * 60
    jwt_refresh_ttl_seconds: int = 7 * 24 * 60 * 60

    root_secret_path: str | None = None
    root_secret: str | None = None

    # File storage
    storage_path: str = "/data/storage"
    max_upload_bytes: int = 100 * 1024 * 1024  # 100 MB default, configurable per org later
    allowed_upload_mime_types: list[str] = Field(
        default_factory=lambda: [
            "application/pdf",
            "image/png",
            "image/jpeg",
            "text/plain",
            "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
            "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        ]
    )

    # Virus scanning (Deployment & Hardening Guide §6)
    virus_scan_enabled: bool = Field(default=True)
    clamd_host: str = "clamav"
    clamd_port: int = 3310

    download_token_ttl_seconds: int = 60
    document_upload_rate_limit_per_minute: int = 20

    # Docs exposure (must be false in production)
    expose_openapi_docs: bool = Field(default=False)

    # Only trust X-Forwarded-For when the app sits behind a proxy we control (Caddy on
    # the internal network) — blindly trusting it otherwise lets an attacker spoof the
    # rate-limit key and bypass per-IP throttling (Pentest Checklist §1).
    trust_proxy_headers: bool = Field(default=False)

    # Rate limiting / lockout (Security Architecture doc §7, Authentication Design §6)
    login_rate_limit_per_ip: int = 5
    login_rate_limit_window_seconds: int = 300
    login_rate_limit_per_account: int = 5
    mfa_rate_limit_per_challenge: int = 5
    mfa_rate_limit_window_seconds: int = 300
    lockout_schedule_minutes: list[int] = Field(default_factory=lambda: [1, 5, 30, 1440])

    # Off by default would be wrong for a real deployment (Authentication Design doc
    # §3 requires MFA for system_admin) — this exists only because this specific
    # deployment explicitly asked to drop MFA for ease of use among a small trusted
    # test group. Never default this to false; only override via env var per-deploy.
    mfa_enforced: bool = Field(default=True)
    # Same story: forcing a password change on first login (before the account is
    # usable at all) is correct security hygiene for a one-time admin-issued password,
    # but this deployment asked for zero friction — change password becomes an
    # optional, self-service action from the dashboard instead of a login gate.
    force_password_change: bool = Field(default=True)

    # Pabari ERP base URL for SSO token validation (server-to-server call)
    # e.g. https://pabari-erp.up.railway.app  — leave empty to disable SSO
    pabari_url: str = Field(default="")

    # Alias of the one person allowed to mark a task Resolved — an approval gate
    # requested for a specific named individual, not a role tier (project_admin is
    # shared by everyone who set this deployment up, and demoting them to strip
    # this one ability would also strip task.delete/milestone.create/document.approve
    # etc., which is a much bigger change than what was actually asked for). None
    # means the gate is off and anyone with task.update can resolve, same as before.
    task_approver_alias: str | None = Field(default=None)
    mfa_challenge_ttl_seconds: int = 120
    # ±30s per unit. 1 (±30s) is the production default (Authentication Design doc §3).
    # Widen only for local/dev to tolerate human-relay latency during manual testing —
    # never in production, since it directly extends how long a captured code is usable.
    totp_valid_window: int = 1
    ws_connect_rate_limit_per_minute: int = 10

    @field_validator("environment")
    @classmethod
    def _validate_env(cls, v: str) -> str:
        allowed = {"development", "test", "production"}
        if v not in allowed:
            raise ValueError(f"environment must be one of {allowed}")
        return v

    @field_validator("cookie_samesite")
    @classmethod
    def _validate_cookie_samesite(cls, v: str) -> str:
        allowed = {"strict", "lax", "none"}
        if v not in allowed:
            raise ValueError(f"cookie_samesite must be one of {allowed}")
        return v

    def resolve_secret(self, inline: str | None, path: str | None, name: str) -> str:
        """Resolve a secret from an inline value (dev convenience) or a mounted file (prod)."""
        if path:
            resolved = Path(path)
            if not resolved.exists():
                raise RuntimeError(f"Secret file for {name} not found at {path}")
            return resolved.read_text(encoding="utf-8").strip()
        if inline:
            return inline
        raise RuntimeError(f"No value or file path configured for secret: {name}")

    @property
    def is_production(self) -> bool:
        return self.environment == "production"


def _read_file_env_overrides() -> dict[str, str]:
    """Supports the *_FILE convention for Docker secrets (Deployment & Hardening Guide
    §8) for values pydantic-settings doesn't otherwise treat as secret file paths —
    e.g. DATABASE_URL_FILE / REDIS_URL_FILE, since those contain embedded credentials."""
    overrides: dict[str, str] = {}
    for env_name, target_field in (("DATABASE_URL_FILE", "database_url"), ("REDIS_URL_FILE", "redis_url")):
        file_path = os.environ.get(env_name)
        if file_path:
            overrides[target_field] = Path(file_path).read_text(encoding="utf-8").strip()
    return overrides


@lru_cache
def get_settings() -> Settings:
    return Settings(**_read_file_env_overrides())  # type: ignore[call-arg]
