import enum
import uuid
from datetime import date, datetime
from typing import List, Optional

from sqlalchemy import Date, DateTime, Enum, Numeric, String, Text, func
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base_class import Base, UUIDMixin


class ProjectStatus(str, enum.Enum):
    planning = "planning"
    active = "active"
    on_hold = "on_hold"
    completed = "completed"
    cancelled = "cancelled"


class ProjectHealth(str, enum.Enum):
    on_track = "on_track"
    at_risk = "at_risk"
    delayed = "delayed"


class Project(UUIDMixin, Base):
    __tablename__ = "projects"

    name: Mapped[str] = mapped_column(String(255), nullable=False)
    code: Mapped[Optional[str]] = mapped_column(String(50), unique=True, nullable=True)
    description: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    status: Mapped[ProjectStatus] = mapped_column(
        Enum(ProjectStatus, name="project_status"), nullable=False, default=ProjectStatus.planning
    )
    health: Mapped[ProjectHealth] = mapped_column(
        Enum(ProjectHealth, name="project_health"), nullable=False, default=ProjectHealth.on_track
    )
    start_date: Mapped[Optional[date]] = mapped_column(Date, nullable=True)
    end_date: Mapped[Optional[date]] = mapped_column(Date, nullable=True)
    budget_amount: Mapped[Optional[float]] = mapped_column(Numeric(18, 2), nullable=True)
    budget_currency: Mapped[Optional[str]] = mapped_column(String(10), nullable=True, default="USD")
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())

    participants: Mapped[List["ProjectParticipant"]] = relationship(
        back_populates="project", cascade="all, delete-orphan"
    )
    milestones: Mapped[List["Milestone"]] = relationship(
        back_populates="project", cascade="all, delete-orphan"
    )
    deliverables: Mapped[List["Deliverable"]] = relationship(
        back_populates="project", cascade="all, delete-orphan"
    )
    risks: Mapped[List["Risk"]] = relationship(back_populates="project", cascade="all, delete-orphan")
    decisions: Mapped[List["Decision"]] = relationship(
        back_populates="project", cascade="all, delete-orphan"
    )
