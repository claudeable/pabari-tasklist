import uuid
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.core.audit import log_activity
from app.core.deps import get_current_user, get_db, require_permission
from app.models.kb_article import KBArticle
from app.models.user import User
from app.schemas.kb_article import KBArticleCreate, KBArticleRead

router = APIRouter()


@router.get("", response_model=list[KBArticleRead])
def list_kb_articles(
    category: Optional[str] = None,
    q: Optional[str] = None,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> list[KBArticle]:
    query = db.query(KBArticle)
    if category is not None:
        query = query.filter(KBArticle.category == category)
    if q:
        like = f"%{q}%"
        query = query.filter(
            (KBArticle.title.ilike(like)) | (KBArticle.content.ilike(like))
        )
    return query.order_by(KBArticle.created_at.desc()).all()


@router.get("/{article_id}", response_model=KBArticleRead)
def get_kb_article(
    article_id: uuid.UUID,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> KBArticle:
    article = db.get(KBArticle, article_id)
    if not article:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Article not found")
    return article


@router.post("", response_model=KBArticleRead, status_code=status.HTTP_201_CREATED)
def create_kb_article(
    payload: KBArticleCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_permission("knowledge_base.edit")),
) -> KBArticle:
    article = KBArticle(**payload.model_dump(), author_user_id=current_user.id)
    db.add(article)
    db.flush()
    log_activity(
        db,
        user_id=current_user.id,
        action="create",
        entity_type="kb_article",
        entity_id=str(article.id),
        description=f"Published knowledge base article '{article.title}'",
    )
    db.commit()
    db.refresh(article)
    return article
