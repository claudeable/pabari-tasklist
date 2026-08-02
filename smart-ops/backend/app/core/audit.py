import uuid
from typing import Optional

from sqlalchemy.orm import Session

from app.models.activity_log import ActivityLog
from app.models.notification import Notification


def log_activity(
    db: Session,
    *,
    user_id: Optional[uuid.UUID],
    action: str,
    entity_type: str,
    entity_id: Optional[str] = None,
    project_id: Optional[uuid.UUID] = None,
    organization_id: Optional[uuid.UUID] = None,
    description: Optional[str] = None,
) -> None:
    """Record an activity log entry. Does not commit — caller commits."""
    log = ActivityLog(
        project_id=project_id,
        organization_id=organization_id,
        user_id=user_id,
        action=action,
        entity_type=entity_type,
        entity_id=entity_id,
        description=description,
    )
    db.add(log)


def notify_user(
    db: Session,
    *,
    user_id: uuid.UUID,
    type: str,
    title: str,
    body: Optional[str] = None,
) -> None:
    """Create a notification for a user. Does not commit — caller commits."""
    notification = Notification(
        user_id=user_id,
        type=type,
        title=title,
        body=body,
    )
    db.add(notification)
