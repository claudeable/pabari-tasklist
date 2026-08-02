import uuid

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.core.audit import log_activity
from app.core.deps import get_current_user, get_db, require_permission
from app.models.organization import Organization
from app.models.project import Project
from app.models.project_participant import ProjectParticipant
from app.models.user import User
from app.schemas.organization import (
    OrganizationCreate,
    OrganizationDetailRead,
    OrganizationRead,
    OrganizationUpdate,
)

router = APIRouter()


@router.get("", response_model=list[OrganizationRead])
def list_organizations(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> list[Organization]:
    return db.query(Organization).order_by(Organization.name).all()


@router.get("/{organization_id}", response_model=OrganizationDetailRead)
def get_organization(
    organization_id: uuid.UUID,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> OrganizationDetailRead:
    org = db.get(Organization, organization_id)
    if not org:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Organization not found")

    project_ids = (
        db.query(ProjectParticipant.project_id)
        .filter(ProjectParticipant.organization_id == organization_id)
        .distinct()
        .all()
    )
    projects = (
        db.query(Project).filter(Project.id.in_([p[0] for p in project_ids])).all()
        if project_ids
        else []
    )

    detail = OrganizationDetailRead.model_validate(org)
    detail.projects_involved = [
        {"id": p.id, "name": p.name, "status": p.status} for p in projects
    ]
    return detail


@router.post("", response_model=OrganizationRead, status_code=status.HTTP_201_CREATED)
def create_organization(
    payload: OrganizationCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_permission("organizations.edit")),
) -> Organization:
    org = Organization(**payload.model_dump())
    db.add(org)
    db.flush()
    log_activity(
        db,
        user_id=current_user.id,
        action="create",
        entity_type="organization",
        entity_id=str(org.id),
        organization_id=org.id,
        description=f"Created organization '{org.name}'",
    )
    db.commit()
    db.refresh(org)
    return org


@router.put("/{organization_id}", response_model=OrganizationRead)
def update_organization(
    organization_id: uuid.UUID,
    payload: OrganizationUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_permission("organizations.edit")),
) -> Organization:
    org = db.get(Organization, organization_id)
    if not org:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Organization not found")

    for field, value in payload.model_dump(exclude_unset=True).items():
        setattr(org, field, value)

    log_activity(
        db,
        user_id=current_user.id,
        action="update",
        entity_type="organization",
        entity_id=str(org.id),
        organization_id=org.id,
        description=f"Updated organization '{org.name}'",
    )

    db.commit()
    db.refresh(org)
    return org


@router.delete("/{organization_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_organization(
    organization_id: uuid.UUID,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_permission("organizations.edit")),
) -> None:
    org = db.get(Organization, organization_id)
    if not org:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Organization not found")

    # users.organization_id is ForeignKey(..., ondelete="CASCADE") — deleting
    # the org would silently delete every one of its user accounts. That's
    # too destructive to do implicitly, so require the caller to reassign or
    # deactivate/remove the users first.
    user_count = db.query(User).filter(User.organization_id == organization_id).count()
    if user_count > 0:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Cannot delete an organization with active users — reassign or deactivate them first.",
        )

    log_activity(
        db,
        user_id=current_user.id,
        action="delete",
        entity_type="organization",
        entity_id=str(org.id),
        description=f"Deleted organization '{org.name}'",
    )

    # project_participants.organization_id is also ON DELETE CASCADE, so any
    # participant rows for this org are cleaned up automatically.
    db.delete(org)
    db.commit()
