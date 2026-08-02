import enum
import uuid
from datetime import datetime
from typing import Optional

from sqlalchemy import DateTime, Enum, ForeignKey, String, Text, func
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base_class import Base, UUIDMixin


class RiskSeverity(str, enum.Enum):
    low = "low"
    medium = "medium"
    high = "high"
    critical = "critical"


class RiskLikelihood(str, enum.Enum):
    low = "low"
    medium = "medium"
    high = "high"


class RiskStatus(str, enum.Enum):
    open = "open"
    mitigated = "mitigated"
    closed = "closed"


class Risk(UUIDMixin, Base):
    __tablename__ = "risks"

    project_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("projects.id", ondelete="CASCADE"), nullable=False
    )
    title: Mapped[str] = mapped_column(String(255), nullable=False)
    description: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    severity: Mapped[RiskSeverity] = mapped_column(
        Enum(RiskSeverity, name="risk_severity"), nullable=False, default=RiskSeverity.medium
    )
    likelihood: Mapped[RiskLikelihood] = mapped_column(
        Enum(RiskLikelihood, name="risk_likelihood"), nullable=False, default=RiskLikelihood.medium
    )
    status: Mapped[RiskStatus] = mapped_column(
        Enum(RiskStatus, name="risk_status"), nullable=False, default=RiskStatus.open
    )
    owner_user_id: Mapped[Optional[uuid.UUID]] = mapped_column(
        UUID(as_uuid=True), ForeignKey("users.id", ondelete="SET NULL"), nullable=True
    )
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())

    project: Mapped["Project"] = relationship(back_populates="risks")
    owner: Mapped[Optional["User"]] = relationship()
