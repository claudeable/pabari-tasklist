"""add progress_percent to project_updates

Revision ID: 0012
Revises: 0011
Create Date: 2026-09-14
"""
from typing import Union
from alembic import op

revision: str = "0012"
down_revision: Union[str, None] = "0011"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.execute("ALTER TABLE project_updates ADD COLUMN IF NOT EXISTS progress_percent INTEGER DEFAULT 0")


def downgrade() -> None:
    op.execute("ALTER TABLE project_updates DROP COLUMN IF EXISTS progress_percent")
