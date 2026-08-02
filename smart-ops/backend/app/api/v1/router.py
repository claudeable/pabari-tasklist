from fastapi import APIRouter

from app.api.v1.endpoints import (
    auth,
    communication,
    dashboard,
    decisions,
    deliverables,
    documents,
    engineering,
    knowledge_base,
    meetings,
    milestones,
    notifications,
    organizations,
    presence,
    project_participants,
    projects,
    reports,
    risks,
    roles,
    site_progress,
    tasks,
    users,
)

api_router = APIRouter()

api_router.include_router(auth.router, prefix="/auth", tags=["auth"])
api_router.include_router(users.router, prefix="/users", tags=["users"])
api_router.include_router(organizations.router, prefix="/organizations", tags=["organizations"])
api_router.include_router(projects.router, prefix="/projects", tags=["projects"])
api_router.include_router(roles.router, prefix="/roles", tags=["roles"])
api_router.include_router(milestones.router, prefix="/milestones", tags=["milestones"])
api_router.include_router(deliverables.router, prefix="/deliverables", tags=["deliverables"])
api_router.include_router(risks.router, prefix="/risks", tags=["risks"])
api_router.include_router(decisions.router, prefix="/decisions", tags=["decisions"])
api_router.include_router(
    project_participants.router, prefix="/project-participants", tags=["project-participants"]
)
api_router.include_router(dashboard.router, prefix="/dashboard", tags=["dashboard"])
api_router.include_router(documents.router, prefix="/documents", tags=["documents"])
api_router.include_router(tasks.router, prefix="/tasks", tags=["tasks"])
api_router.include_router(meetings.router, prefix="/meetings", tags=["meetings"])
api_router.include_router(communication.router, prefix="", tags=["communication"])
api_router.include_router(engineering.router, prefix="", tags=["engineering"])
api_router.include_router(site_progress.router, prefix="/site-reports", tags=["site-progress"])
api_router.include_router(knowledge_base.router, prefix="/kb-articles", tags=["knowledge-base"])
api_router.include_router(notifications.router, prefix="/notifications", tags=["notifications"])
api_router.include_router(reports.router, prefix="/reports", tags=["reports"])
api_router.include_router(presence.router, prefix="", tags=["presence"])
