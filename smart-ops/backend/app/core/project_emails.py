"""Queue project activity emails only after the transaction commits."""

import logging
from html import escape

from sqlalchemy import event
from sqlalchemy.orm import Session

from app.core.email import send_notification_email
from app.models.project import Project
from app.models.project_participant import ProjectParticipant
from app.models.user import User

logger = logging.getLogger(__name__)


def queue_project_email(db, *, project_id, user_id, description, action=None, entity_type=None):
    if project_id is None or "background_tasks" not in db.info:
        return
    if entity_type == "project_participant" and action == "create":
        return
    try:
        project = db.get(Project, project_id)
        actor = db.get(User, user_id) if user_id else None
        if project is None:
            return
        recipients = db.query(User.email).join(
            ProjectParticipant, ProjectParticipant.user_id == User.id
        ).filter(
            ProjectParticipant.project_id == project_id,
            User.is_active.is_(True),
        ).all()
        addresses = {email.strip().lower() for (email,) in recipients if email and "@" in email}
        body = (
            f"<strong>{escape(actor.full_name if actor else 'Smart Ops')}</strong> "
            f"made a change in <strong>{escape(project.name)}</strong>.<br><br>"
            f"{escape(description or 'Project updated.')}"
        )
        subject = f"Smart Ops: {project.name} updated"
        for address in addresses:
            db.info.setdefault("project_emails", []).append(
                (address, subject, body)
            )
    except Exception:
        logger.exception("Could not queue project notification")


@event.listens_for(Session, "after_commit")
def schedule_project_emails(db):
    messages = db.info.pop("project_emails", [])
    background_tasks = db.info.get("background_tasks")
    if background_tasks is not None:
        for message in messages:
            background_tasks.add_task(send_notification_email, *message)


@event.listens_for(Session, "after_rollback")
def discard_project_emails(db):
    db.info.pop("project_emails", None)
