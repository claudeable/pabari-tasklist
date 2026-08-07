import logging

from alembic import command
from alembic.config import Config
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

import app.db.base  # noqa: F401  ensures all models are registered before any mapper is used
from app.api.v1.router import api_router
from app.core.config import settings

logger = logging.getLogger(__name__)


def _run_migrations() -> None:
    try:
        cfg = Config("alembic.ini")
        command.upgrade(cfg, "head")
        logger.info("Database migrations applied.")
    except Exception as exc:
        logger.warning("Migration failed (will continue): %s", exc)


_run_migrations()

app = FastAPI(title=settings.PROJECT_NAME)

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins_list,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(api_router, prefix=settings.API_V1_PREFIX)


@app.get("/health")
def health_check() -> dict:
    return {"status": "ok"}
