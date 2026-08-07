from functools import lru_cache
from typing import List

from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    """Application settings loaded from environment variables (.env supported)."""

    model_config = SettingsConfigDict(env_file=".env", extra="ignore")

    PROJECT_NAME: str = "Smart Ops Portal API"
    API_V1_PREFIX: str = "/api/v1"

    DATABASE_URL: str = (
        "postgresql+psycopg2://postgres:postgres@localhost:5432/joint_collab_portal"
    )

    JWT_SECRET: str = "change-me-to-a-long-random-secret"
    JWT_ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 10080  # 7 days

    CORS_ORIGINS: str = "http://localhost:3000"

    # Auth cookie transport. In production (cross-site: frontend and backend
    # are on different Vercel domains) this must be Secure + SameSite=None
    # for the browser to send it on cross-origin fetches. For local dev over
    # plain http, override via env to COOKIE_SECURE=false / COOKIE_SAMESITE=lax.
    COOKIE_SECURE: bool = True
    COOKIE_SAMESITE: str = "none"
    AUTH_COOKIE_NAME: str = "jcp_access_token"

    LOGIN_RATE_LIMIT_ATTEMPTS: int = 5
    LOGIN_RATE_LIMIT_WINDOW_MINUTES: int = 15

    # SSO — set PABARI_URL to https://pabari-workspace.up.railway.app in Railway env vars
    PABARI_URL: str = ""

    # Email — Resend API (set RESEND_API_KEY and EMAIL_FROM in Railway env vars)
    RESEND_API_KEY: str = ""
    EMAIL_FROM: str = "Smart Ops <notifications@pabarigroup.com>"
    RESEND_ENABLED: bool = True

    @property
    def cors_origins_list(self) -> List[str]:
        return [origin.strip() for origin in self.CORS_ORIGINS.split(",") if origin.strip()]


@lru_cache
def get_settings() -> Settings:
    return Settings()


settings = get_settings()
