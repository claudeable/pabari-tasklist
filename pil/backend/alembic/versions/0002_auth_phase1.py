"""phase 1 auth: totp_last_step, backup_codes

Revision ID: 0002
Revises: 0001
Create Date: 2026-07-20
"""
from collections.abc import Sequence

import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

from alembic import op

revision: str = "0002"
down_revision: str | None = "0001"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.add_column("users", sa.Column("totp_last_step", sa.Integer, nullable=True))

    op.create_table(
        "backup_codes",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True, server_default=sa.text("gen_random_uuid()")),
        sa.Column("user_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("users.id", ondelete="CASCADE"), nullable=False),
        sa.Column("code_hash", sa.String, nullable=False),
        sa.Column("used_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
    )
    op.create_index("ix_backup_codes_user_id", "backup_codes", ["user_id"])

    op.execute("GRANT SELECT, INSERT, UPDATE, DELETE ON backup_codes TO app_role")


def downgrade() -> None:
    op.drop_table("backup_codes")
    op.drop_column("users", "totp_last_step")
