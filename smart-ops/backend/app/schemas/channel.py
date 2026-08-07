import uuid
from datetime import datetime
from typing import Optional

from pydantic import BaseModel, ConfigDict


class ChannelBase(BaseModel):
    name: str


class ChannelCreate(ChannelBase):
    project_id: uuid.UUID


class ChannelMemberRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    user_id: uuid.UUID
    user_name: Optional[str] = None


class ChannelRead(ChannelBase):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    project_id: Optional[uuid.UUID] = None
    is_direct: bool = False
    is_group: bool = False
    user_a_id: Optional[uuid.UUID] = None
    user_b_id: Optional[uuid.UUID] = None
    other_user_name: Optional[str] = None
    members: list[ChannelMemberRead] = []
    created_at: datetime


class DirectChannelCreate(BaseModel):
    other_user_id: uuid.UUID


class GroupChannelCreate(BaseModel):
    name: str
    member_user_ids: list[uuid.UUID] = []


class MessageBase(BaseModel):
    body: str


class MessageCreate(MessageBase):
    pass


class MessageRead(MessageBase):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    channel_id: uuid.UUID
    user_id: uuid.UUID
    user_name: Optional[str] = None
    created_at: datetime
