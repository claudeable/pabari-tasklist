"""ensure project_updates has posted_at column

Revision ID: 0008
Revises: 0007
Create Date: 2026-09-14

"""
from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

revision: str = "0008"
down_revision: Union[str, None] = "0007"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # ADD COLUMN IF NOT EXISTS is safe to run even if posted_at already exists
    # (handles the case where 0007 already ran with the posted_at column included)
    op.execute("""
        ALTER TABLE project_updates
        ADD COLUMN IF NOT EXISTS posted_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    """)
    # Backfill: any rows created before this column existed use created_at
    op.execute("""
        UPDATE project_updates SET posted_at = created_at WHERE posted_at = NOW()
    """)


def downgrade() -> None:
    op.drop_column("project_updates", "posted_at")
