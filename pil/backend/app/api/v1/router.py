from fastapi import APIRouter

from app.api.v1 import (
    admin,
    auth,
    channels,
    documents,
    health,
    messages,
    notifications,
    organizations,
    projects,
    tasks,
    users,
    ws,
)

api_router = APIRouter(prefix="/api/v1")
api_router.include_router(health.router)
api_router.include_router(auth.router)
api_router.include_router(users.router)
api_router.include_router(organizations.router)
api_router.include_router(projects.router)
api_router.include_router(channels.router)
api_router.include_router(messages.router)
api_router.include_router(ws.router)
api_router.include_router(documents.router)
api_router.include_router(tasks.router)
api_router.include_router(notifications.router)
api_router.include_router(admin.router)

# This completes the Development Roadmap's Phase 0-6 route set. Post-v1 items (HA,
# optional E2EE mode, advanced export/legal-hold tooling) are tracked in
# docs/14-development-roadmap.md Phase 8, not stubbed here.
