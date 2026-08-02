from datetime import datetime, timezone

from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.core.deps import get_current_user, get_db
from app.models.user import User

router = APIRouter()


@router.post("/presence/ping")
def ping_presence(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> dict:
    current_user.last_seen_at = datetime.now(timezone.utc)
    db.add(current_user)
    db.commit()
    return {"status": "ok"}
