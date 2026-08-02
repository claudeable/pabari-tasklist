import uuid
from datetime import datetime
from typing import Optional

from pydantic import BaseModel, ConfigDict, EmailStr

from app.schemas.role import RoleRead


class UserBase(BaseModel):
    full_name: str
    email: EmailStr
    phone: Optional[str] = None
    title: Optional[str] = None
    avatar_url: Optional[str] = None


class UserCreate(UserBase):
    organization_id: uuid.UUID
    department_id: Optional[uuid.UUID] = None
    role_id: uuid.UUID
    password: str


class UserUpdate(BaseModel):
    full_name: Optional[str] = None
    phone: Optional[str] = None
    title: Optional[str] = None
    avatar_url: Optional[str] = None
    department_id: Optional[uuid.UUID] = None
    role_id: Optional[uuid.UUID] = None
    is_active: Optional[bool] = None


class UserSelfUpdate(BaseModel):
    full_name: Optional[str] = None
    phone: Optional[str] = None
    title: Optional[str] = None
    avatar_url: Optional[str] = None


class UserRead(UserBase):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    organization_id: uuid.UUID
    department_id: Optional[uuid.UUID] = None
    role_id: uuid.UUID
    is_active: bool
    created_at: datetime
    last_seen_at: Optional[datetime] = None


class UserReadWithRole(UserRead):
    role: Optional[RoleRead] = None
