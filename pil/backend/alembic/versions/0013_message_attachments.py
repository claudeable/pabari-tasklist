"""chat file/photo attachments — message_attachments table + RLS

Revision ID: 0013
Revises: 0012
Create Date: 2026-07-31

Deliberately NOT reusing the `documents` table: its RLS policy is org-scoped only
(migration 0005), with no concept of private-channel/DM membership. Storing a DM's
photo as a plain Document would make it visible to the whole project via the general
Documents list. This table instead mirrors `messages`' own tenant_isolation policy
(migration 0004) exactly — org match, or a partner-org's channel — since privacy of
private channels/DMs is already enforced at the app layer for `messages` itself
(get_channel_scoped_session checks channel_repository.is_member), and attachment
access goes through that same app-layer gate before ever reaching this table.
"""
from collections.abc import Sequence

import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

from alembic import op

revision: str = "0013"
down_revision: str | None = "0012"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.create_table(
        "message_attachments",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True, server_default=sa.text("gen_random_uuid()")),
        sa.Column("message_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("messages.id", ondelete="CASCADE"), nullable=False),
        sa.Column("channel_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("channels.id", ondelete="CASCADE"), nullable=False),
        sa.Column("organization_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("storage_key", sa.String, nullable=False, unique=True),
        sa.Column("encrypted_dek", sa.String, nullable=False),
        sa.Column("file_hash_sha256", sa.String(64), nullable=False),
        sa.Column("size_bytes", sa.BigInteger, nullable=False),
        sa.Column("mime_type", sa.String(150), nullable=False),
        sa.Column("original_filename", sa.String(255), nullable=False),
        sa.Column("scan_status", sa.String(20), nullable=False, server_default="pending"),
        sa.Column("uploaded_by", postgresql.UUID(as_uuid=True), sa.ForeignKey("users.id"), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
    )
    op.create_index("ix_message_attachments_message_id", "message_attachments", ["message_id"])
    op.create_index("ix_message_attachments_channel_id", "message_attachments", ["channel_id"])
    op.create_index("ix_message_attachments_organization_id", "message_attachments", ["organization_id"])

    op.execute("GRANT SELECT, INSERT, UPDATE, DELETE ON message_attachments TO app_role")
    op.execute("GRANT SELECT ON message_attachments TO app_readonly_role")

    # SECURITY DEFINER bootstrap lookup — same rationale as get_channel_organization_id
    # / get_message_organization_id (migration 0004): a request scoped to one
    # attachment needs to learn its owning org BEFORE app.current_org_id can be set,
    # but FORCE ROW LEVEL SECURITY blocks that lookup for app_role otherwise.
    op.execute(
        """
        CREATE FUNCTION get_attachment_organization_id(p_attachment_id uuid) RETURNS uuid
        LANGUAGE sql SECURITY DEFINER STABLE AS $$
            SELECT organization_id FROM message_attachments WHERE id = p_attachment_id;
        $$
        """
    )
    op.execute("REVOKE ALL ON FUNCTION get_attachment_organization_id(uuid) FROM PUBLIC")
    op.execute("GRANT EXECUTE ON FUNCTION get_attachment_organization_id(uuid) TO app_role")

    op.execute("ALTER TABLE message_attachments ENABLE ROW LEVEL SECURITY")
    op.execute("ALTER TABLE message_attachments FORCE ROW LEVEL SECURITY")
    op.execute(
        """
        CREATE POLICY tenant_isolation ON message_attachments
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


def downgrade() -> None:
    op.execute("DROP POLICY IF EXISTS tenant_isolation ON message_attachments")
    op.execute("DROP FUNCTION IF EXISTS get_attachment_organization_id(uuid)")
    op.drop_table("message_attachments")
