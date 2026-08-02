"""direct-message channels and user presence tracking

Revision ID: 0004
Revises: 0003
Create Date: 2026-07-31

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

# revision identifiers, used by Alembic.
revision: str = "0004"
down_revision: Union[str, None] = "0003"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.alter_column("channels", "project_id", existing_type=postgresql.UUID(as_uuid=True), nullable=True)
    op.add_column(
        "channels",
        sa.Column("is_direct", sa.Boolean(), nullable=False, server_default=sa.false()),
    )
    op.add_column(
        "channels",
        sa.Column("user_a_id", postgresql.UUID(as_uuid=True), nullable=True),
    )
    op.add_column(
        "channels",
        sa.Column("user_b_id", postgresql.UUID(as_uuid=True), nullable=True),
    )
    op.create_foreign_key(
        "fk_channels_user_a_id_users", "channels", "users", ["user_a_id"], ["id"], ondelete="CASCADE"
    )
    op.create_foreign_key(
        "fk_channels_user_b_id_users", "channels", "users", ["user_b_id"], ["id"], ondelete="CASCADE"
    )
    op.create_unique_constraint(
        "uq_channels_user_a_id_user_b_id", "channels", ["user_a_id", "user_b_id"]
    )

    op.add_column(
        "users",
        sa.Column("last_seen_at", sa.DateTime(timezone=True), nullable=True),
    )


def downgrade() -> None:
    op.drop_column("users", "last_seen_at")

    op.drop_constraint("uq_channels_user_a_id_user_b_id", "channels", type_="unique")
    op.drop_constraint("fk_channels_user_b_id_users", "channels", type_="foreignkey")
    op.drop_constraint("fk_channels_user_a_id_users", "channels", type_="foreignkey")
    op.drop_column("channels", "user_b_id")
    op.drop_column("channels", "user_a_id")
    op.drop_column("channels", "is_direct")
    op.alter_column("channels", "project_id", existing_type=postgresql.UUID(as_uuid=True), nullable=False)
