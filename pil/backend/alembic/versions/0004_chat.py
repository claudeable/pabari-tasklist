"""phase 3: channels, messages, message_reads, message_search_index, RLS

Revision ID: 0004
Revises: 0003
Create Date: 2026-07-21
"""
from collections.abc import Sequence

import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

from alembic import op

revision: str = "0004"
down_revision: str | None = "0003"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.create_table(
        "channels",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True, server_default=sa.text("gen_random_uuid()")),
        sa.Column("project_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("projects.id", ondelete="CASCADE"), nullable=False),
        sa.Column("organization_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("name", sa.String(100), nullable=False),
        sa.Column("is_private", sa.Boolean, nullable=False, server_default=sa.text("false")),
        sa.Column("encrypted_dek", sa.String, nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
    )
    op.create_index("ix_channels_project_id", "channels", ["project_id"])
    op.create_index("ix_channels_organization_id", "channels", ["organization_id"])

    op.create_table(
        "messages",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True, server_default=sa.text("gen_random_uuid()")),
        sa.Column("channel_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("channels.id", ondelete="CASCADE"), nullable=False),
        sa.Column("organization_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("author_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("users.id"), nullable=False),
        sa.Column("parent_message_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("messages.id"), nullable=True),
        sa.Column("ciphertext", sa.LargeBinary, nullable=False),
        sa.Column("nonce", sa.LargeBinary, nullable=False),
        sa.Column("edited_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("deleted_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
    )
    op.create_index("ix_messages_channel_id", "messages", ["channel_id"])
    op.create_index("ix_messages_organization_id", "messages", ["organization_id"])
    op.create_index("ix_messages_channel_created_at", "messages", ["channel_id", "created_at"])

    op.create_table(
        "message_reads",
        sa.Column(
            "message_id", postgresql.UUID(as_uuid=True),
            sa.ForeignKey("messages.id", ondelete="CASCADE"), primary_key=True,
        ),
        sa.Column("user_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("users.id", ondelete="CASCADE"), primary_key=True),
        sa.Column("read_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
    )

    op.create_table(
        "message_search_index",
        sa.Column(
            "message_id", postgresql.UUID(as_uuid=True),
            sa.ForeignKey("messages.id", ondelete="CASCADE"), primary_key=True,
        ),
        sa.Column("organization_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("channel_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("tsv", postgresql.TSVECTOR, nullable=False),
    )
    op.create_index("ix_message_search_index_organization_id", "message_search_index", ["organization_id"])
    op.create_index("ix_message_search_index_channel_id", "message_search_index", ["channel_id"])
    op.execute("CREATE INDEX ix_message_search_index_tsv ON message_search_index USING GIN (tsv)")

    for table in ("channels", "messages", "message_reads", "message_search_index"):
        op.execute(f"GRANT SELECT, INSERT, UPDATE, DELETE ON {table} TO app_role")
        op.execute(f"GRANT SELECT ON {table} TO app_readonly_role")

    # --- SECURITY DEFINER bootstrap-lookup functions (see migration 0003 for the
    # rationale — a project-scoped/channel-scoped/message-scoped request needs to
    # learn its owning org BEFORE it can set app.current_org_id, but the tables below
    # have FORCE ROW LEVEL SECURITY, which blocks that lookup for app_role otherwise).
    op.execute(
        """
        CREATE FUNCTION get_channel_organization_id(p_channel_id uuid) RETURNS uuid
        LANGUAGE sql SECURITY DEFINER STABLE AS $$
            SELECT organization_id FROM channels WHERE id = p_channel_id;
        $$
        """
    )
    op.execute("REVOKE ALL ON FUNCTION get_channel_organization_id(uuid) FROM PUBLIC")
    op.execute("GRANT EXECUTE ON FUNCTION get_channel_organization_id(uuid) TO app_role")

    op.execute(
        """
        CREATE FUNCTION get_message_organization_id(p_message_id uuid) RETURNS uuid
        LANGUAGE sql SECURITY DEFINER STABLE AS $$
            SELECT organization_id FROM messages WHERE id = p_message_id;
        $$
        """
    )
    op.execute("REVOKE ALL ON FUNCTION get_message_organization_id(uuid) FROM PUBLIC")
    op.execute("GRANT EXECUTE ON FUNCTION get_message_organization_id(uuid) TO app_role")

    # --- Row-Level Security (Database Design doc §4) ---
    for table in ("channels", "messages", "message_reads", "message_search_index"):
        op.execute(f"ALTER TABLE {table} ENABLE ROW LEVEL SECURITY")
        op.execute(f"ALTER TABLE {table} FORCE ROW LEVEL SECURITY")

    op.execute(
        """
        CREATE POLICY tenant_isolation ON channels
        USING (
            organization_id = current_setting('app.current_org_id', true)::uuid
            OR project_id IN (
                SELECT project_id FROM project_partner_orgs
                WHERE organization_id = current_setting('app.current_org_id', true)::uuid
            )
        )
        """
    )
    op.execute(
        """
        CREATE POLICY tenant_isolation ON messages
        USING (
            organization_id = current_setting('app.current_org_id', true)::uuid
            OR channel_id IN (
                SELECT c.id FROM channels c
                JOIN project_partner_orgs ppo ON ppo.project_id = c.project_id
                WHERE ppo.organization_id = current_setting('app.current_org_id', true)::uuid
            )
        )
        """
    )
    op.execute(
        """
        CREATE POLICY tenant_isolation ON message_reads
        USING (
            message_id IN (
                SELECT id FROM messages
                WHERE organization_id = current_setting('app.current_org_id', true)::uuid
            )
        )
        """
    )
    op.execute(
        """
        CREATE POLICY tenant_isolation ON message_search_index
        USING (organization_id = current_setting('app.current_org_id', true)::uuid)
        """
    )


def downgrade() -> None:
    for table in ("message_search_index", "message_reads", "messages", "channels"):
        op.execute(f"DROP POLICY IF EXISTS tenant_isolation ON {table}")
    op.execute("DROP FUNCTION IF EXISTS get_message_organization_id(uuid)")
    op.execute("DROP FUNCTION IF EXISTS get_channel_organization_id(uuid)")
    op.drop_table("message_search_index")
    op.drop_table("message_reads")
    op.drop_table("messages")
    op.drop_table("channels")
