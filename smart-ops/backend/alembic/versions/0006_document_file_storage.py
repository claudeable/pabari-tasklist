"""add file_data and file_mime_type to documents

Revision ID: 0006
Revises: 0005
Create Date: 2026-08-07

"""
from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

revision: str = "0006"
down_revision: Union[str, None] = "0005"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column("documents", sa.Column("file_data", sa.LargeBinary(), nullable=True))
    op.add_column("documents", sa.Column("file_mime_type", sa.String(255), nullable=True))


def downgrade() -> None:
    op.drop_column("documents", "file_mime_type")
    op.drop_column("documents", "file_data")
