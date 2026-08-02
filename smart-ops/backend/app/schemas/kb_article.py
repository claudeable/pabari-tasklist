import uuid
from datetime import datetime
from typing import List, Optional

from pydantic import BaseModel, ConfigDict


class KBArticleBase(BaseModel):
    category: str
    title: str
    content: str
    tags: Optional[List[str]] = None


class KBArticleCreate(KBArticleBase):
    pass


class KBArticleRead(KBArticleBase):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    author_user_id: Optional[uuid.UUID] = None
    created_at: datetime
