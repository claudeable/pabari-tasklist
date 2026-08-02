"""channel_members: per-channel membership for private channels and DMs

Revision ID: 0009
Revises: 0008
Create Date: 2026-07-30

Non-private channels stay org-wide visible (existing `channels` RLS policy is
already correct for that). Private channels — including 1:1 DMs, modeled as a
private channel with exactly 2 members — need real per-channel membership,
since org-wide RLS alone would let any org member read a DM meant for two
specific people.
"""
from collections.abc import Sequence

import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

from alembic import op

revision: str = "0009"
down_revision: str | None = "0008"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.create_table(
        "channel_members",
        sa.Column(
            "channel_id", postgresql.UUID(as_uuid=True),
            sa.ForeignKey("channels.id", ondelete="CASCADE"), primary_key=True,
        ),
        sa.Column(
            "user_id", postgresql.UUID(as_uuid=True),
            sa.ForeignKey("users.id", ondelete="CASCADE"), primary_key=True,
        ),
        sa.Column("organization_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("added_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
    )
    op.create_index("ix_channel_members_organization_id", "channel_members", ["organization_id"])
    op.create_index("ix_channel_members_user_id", "channel_members", ["user_id"])

    op.execute("GRANT SELECT, INSERT, UPDATE, DELETE ON channel_members TO app_role")
    op.execute("GRANT SELECT ON channel_members TO app_readonly_role")

    op.execute("ALTER TABLE channel_members ENABLE ROW LEVEL SECURITY")
    op.execute("ALTER TABLE channel_members FORCE ROW LEVEL SECURITY")
    op.execute(
        """
        CREATE POLICY tenant_isolation ON channel_members
        USING (organization_id = app_current_org_id())
        """
    )

    # Backfill: every existing channel's creator wasn't tracked as a member before
    # this table existed. For non-private channels this doesn't matter (org-wide
    # visible regardless), but add whoever created each channel so nothing existing
    # silently loses access if it's ever marked private later.
    op.execute(
        """
        INSERT INTO channel_members (channel_id, user_id, organization_id, added_at)
        SELECT c.id, p.created_by, c.organization_id, c.created_at
        FROM channels c
        JOIN projects p ON p.id = c.project_id
        ON CONFLICT DO NOTHING
        """
    )


def downgrade() -> None:
    op.execute("DROP POLICY IF EXISTS tenant_isolation ON channel_members")
    op.drop_table("channel_members")
