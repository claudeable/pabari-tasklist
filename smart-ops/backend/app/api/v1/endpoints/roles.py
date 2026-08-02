from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.core.deps import get_current_user, get_db
from app.models.role import Role
from app.models.user import User
from app.schemas.role import RoleRead

router = APIRouter()


@router.get("", response_model=list[RoleRead])
def list_roles(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> list[Role]:
    return db.query(Role).order_by(Role.name).all()
