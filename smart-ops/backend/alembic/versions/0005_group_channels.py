"""group channels and channel members

Revision ID: 0005
Revises: 0004
Create Date: 2026-08-07

"""
from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects import postgresql

revision: str = "0005"
down_revision: Union[str, None] = "0004"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # Add is_group column to channels
    op.add_column("channels", sa.Column("is_group", sa.Boolean(), nullable=False, server_default="false"))

    # Create channel_members table
    op.create_table(
        "channel_members",
        sa.Column("id", postgresql.UUID(as_uuid=True), nullable=False, server_default=sa.text("gen_random_uuid()")),
        sa.Column("channel_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("user_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.ForeignKeyConstraint(["channel_id"], ["channels.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["user_id"], ["users.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("channel_id", "user_id", name="uq_channel_member"),
    )
    op.create_index("ix_channel_members_channel_id", "channel_members", ["channel_id"])
    op.create_index("ix_channel_members_user_id", "channel_members", ["user_id"])


def downgrade() -> None:
    op.drop_index("ix_channel_members_user_id", table_name="channel_members")
    op.drop_index("ix_channel_members_channel_id", table_name="channel_members")
    op.drop_table("channel_members")
    op.drop_column("channels", "is_group")
