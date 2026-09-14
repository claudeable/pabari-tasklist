"""add status and comments to project updates

Revision ID: 0010
Revises: 0009
Create Date: 2026-09-14
"""
from typing import Union

from alembic import op

revision: str = "0010"
down_revision: Union[str, None] = "0009"
branch_labels = None
depends_on = None


def upgrade() -> None:
    # Add status column to project_updates
    op.execute("""
        ALTER TABLE project_updates
        ADD COLUMN IF NOT EXISTS status VARCHAR(20) NOT NULL DEFAULT 'open'
    """)

    # Create comments table
    op.execute("""
        CREATE TABLE IF NOT EXISTS project_update_comments (
            id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
            update_id UUID NOT NULL REFERENCES project_updates(id) ON DELETE CASCADE,
            user_id UUID REFERENCES users(id) ON DELETE SET NULL,
            body TEXT NOT NULL,
            created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
        )
    """)
    op.execute("""
        CREATE INDEX IF NOT EXISTS ix_project_update_comments_update_id
        ON project_update_comments(update_id)
    """)


def downgrade() -> None:
    op.execute("DROP TABLE IF EXISTS project_update_comments")
    op.execute("ALTER TABLE project_updates DROP COLUMN IF EXISTS status")
