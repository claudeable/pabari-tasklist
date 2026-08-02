import uuid
from datetime import date, datetime
from typing import List, Optional

from pydantic import BaseModel, ConfigDict


class SiteReportBase(BaseModel):
    report_date: date
    description: str
    progress_percent: int = 0
    weather: Optional[str] = None
    gps_location: Optional[str] = None
    photo_urls: Optional[List[str]] = None


class SiteReportCreate(SiteReportBase):
    project_id: uuid.UUID


class SiteReportRead(SiteReportBase):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    project_id: uuid.UUID
    submitted_by_user_id: Optional[uuid.UUID] = None
    created_at: datetime
