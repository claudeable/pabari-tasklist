"""Add pabari_email column to users for Pabari ERP SSO link

Revision ID: 0015
Revises: 0014
Create Date: 2026-08-02

pabari_email links a PIL alias-based account to a Pabari ERP email address.
When a user SSO's in from Pabari, the backend looks up the PIL user by this
field and issues a normal PIL access token + refresh cookie.

Nullable because PIL users created before SSO integration (or purely internal
users) have no Pabari account. Unique where non-null (one PIL user per Pabari
email).
"""
from collections.abc import Sequence

from alembic import op
import sqlalchemy as sa

revision: str = "0015"
down_revision: str | None = "0014"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.add_column("users", sa.Column("pabari_email", sa.Text(), nullable=True))
    op.create_index(
        "ix_users_pabari_email",
        "users",
        ["pabari_email"],
        unique=True,
        postgresql_where=sa.text("pabari_email IS NOT NULL"),
    )


def downgrade() -> None:
    op.drop_index("ix_users_pabari_email", table_name="users")
    op.drop_column("users", "pabari_email")