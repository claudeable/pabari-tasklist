"""Import Base and all models so Alembic autogenerate / metadata.create_all can see them."""

from app.db.base_class import Base  # noqa: F401

from app.models.organization import Organization  # noqa: F401
from app.models.department import Department  # noqa: F401
from app.models.permission import Permission, role_permissions  # noqa: F401
from app.models.role import Role  # noqa: F401
from app.models.user import User  # noqa: F401
from app.models.project import Project  # noqa: F401
from app.models.project_participant import ProjectParticipant  # noqa: F401
from app.models.milestone import Milestone  # noqa: F401
from app.models.deliverable import Deliverable  # noqa: F401
from app.models.risk import Risk  # noqa: F401
from app.models.decision import Decision  # noqa: F401
from app.models.activity_log import ActivityLog  # noqa: F401
from app.models.document import Document  # noqa: F401
from app.models.task import Task  # noqa: F401
from app.models.meeting import Meeting  # noqa: F401
from app.models.notification import Notification  # noqa: F401
from app.models.channel import Channel, Message  # noqa: F401
from app.models.drawing import Drawing, DrawingComment  # noqa: F401
from app.models.site_report import SiteReport  # noqa: F401
from app.models.kb_article import KBArticle  # noqa: F401
from app.models.login_attempt import LoginAttempt  # noqa: F401
