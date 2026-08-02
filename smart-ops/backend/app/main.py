from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

import app.db.base  # noqa: F401  ensures all models are registered before any mapper is used
from app.api.v1.router import api_router
from app.core.config import settings

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
