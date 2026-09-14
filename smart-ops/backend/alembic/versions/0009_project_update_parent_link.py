"""add parent_update_id for follow-up linking

Revision ID: 0009
Revises: 0008
Create Date: 2026-09-14
"""
from typing import Union

from alembic import op

revision: str = "0009"
down_revision: Union[str, None] = "0008"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.execute("""
        ALTER TABLE project_updates
        ADD COLUMN IF NOT EXISTS parent_update_id UUID
        REFERENCES project_updates(id) ON DELETE SET NULL
    """)
    op.execute("""
        CREATE INDEX IF NOT EXISTS ix_project_updates_parent_update_id
        ON project_updates(parent_update_id)
    """)


def downgrade() -> None:
    op.execute("DROP INDEX IF EXISTS ix_project_updates_parent_update_id")
    op.execute("ALTER TABLE project_updates DROP COLUMN IF EXISTS parent_update_id")
