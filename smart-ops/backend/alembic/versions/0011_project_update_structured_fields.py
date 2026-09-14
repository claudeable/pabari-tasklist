"""add structured fields to project updates

Revision ID: 0011
Revises: 0010
Create Date: 2026-09-14
"""
from typing import Union

from alembic import op

revision: str = "0011"
down_revision: Union[str, None] = "0010"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.execute("ALTER TABLE project_updates ADD COLUMN IF NOT EXISTS current_capacity TEXT")
    op.execute("ALTER TABLE project_updates ADD COLUMN IF NOT EXISTS project_requirement TEXT")
    op.execute("ALTER TABLE project_updates ADD COLUMN IF NOT EXISTS internal_notes TEXT")
    op.execute("ALTER TABLE project_updates ADD COLUMN IF NOT EXISTS action_items TEXT")


def downgrade() -> None:
    op.execute("ALTER TABLE project_updates DROP COLUMN IF EXISTS current_capacity")
    op.execute("ALTER TABLE project_updates DROP COLUMN IF EXISTS project_requirement")
    op.execute("ALTER TABLE project_updates DROP COLUMN IF EXISTS internal_notes")
    op.execute("ALTER TABLE project_updates DROP COLUMN IF EXISTS action_items")
