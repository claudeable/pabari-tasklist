"""add task category (legal/finance/projects/other)

Revision ID: 0010
Revises: 0009
Create Date: 2026-07-30
"""
from collections.abc import Sequence

import sqlalchemy as sa

from alembic import op

revision: str = "0010"
down_revision: str | None = "0009"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.add_column("tasks", sa.Column("category", sa.String(20), nullable=True))
    op.create_check_constraint(
        "ck_tasks_category", "tasks", "category IS NULL OR category IN ('legal','finance','projects','other')"
    )


def downgrade() -> None:
    op.drop_constraint("ck_tasks_category", "tasks", type_="check")
    op.drop_column("tasks", "category")
