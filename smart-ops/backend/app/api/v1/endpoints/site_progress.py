import uuid

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.core.audit import log_activity
from app.core.deps import get_current_user, get_db, require_permission
from app.models.site_report import SiteReport
from app.models.user import User
from app.schemas.site_report import SiteReportCreate, SiteReportRead

router = APIRouter()


@router.get("", response_model=list[SiteReportRead])
def list_site_reports(
    project_id: uuid.UUID,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> list[SiteReport]:
    return (
        db.query(SiteReport)
        .filter(SiteReport.project_id == project_id)
        .order_by(SiteReport.report_date.desc())
        .all()
    )


@router.post("", response_model=SiteReportRead, status_code=status.HTTP_201_CREATED)
def create_site_report(
    payload: SiteReportCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_permission("site_progress.edit")),
) -> SiteReport:
    report = SiteReport(**payload.model_dump(), submitted_by_user_id=current_user.id)
    db.add(report)
    db.flush()
    log_activity(
        db,
        user_id=current_user.id,
        action="create",
        entity_type="site_report",
        entity_id=str(report.id),
        project_id=report.project_id,
        description=f"Submitted site report for {report.report_date}",
    )
    db.commit()
    db.refresh(report)
    return report


@router.delete("/{report_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_site_report(
    report_id: uuid.UUID,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_permission("site_progress.edit")),
) -> None:
    report = db.get(SiteReport, report_id)
    if not report:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Site report not found")
    log_activity(
        db,
        user_id=current_user.id,
        action="delete",
        entity_type="site_report",
        entity_id=str(report.id),
        project_id=report.project_id,
        description=f"Deleted site report for {report.report_date}",
    )
    db.delete(report)
    db.commit()
