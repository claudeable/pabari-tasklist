"""phase 6: notifications, RLS by recipient, storage-usage admin aggregate functions

Revision ID: 0007
Revises: 0006
Create Date: 2026-07-21
"""
from collections.abc import Sequence

import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

from alembic import op

revision: str = "0007"
down_revision: str | None = "0006"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.create_table(
        "notifications",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True, server_default=sa.text("gen_random_uuid()")),
        sa.Column("recipient_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("users.id", ondelete="CASCADE"), nullable=False),
        sa.Column("type", sa.String(50), nullable=False),
        sa.Column("payload", postgresql.JSONB, nullable=False),
        sa.Column("read_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
    )
    op.create_index("ix_notifications_recipient_id", "notifications", ["recipient_id"])

    op.execute("GRANT SELECT, INSERT, UPDATE, DELETE ON notifications TO app_role")
    op.execute("GRANT SELECT ON notifications TO app_readonly_role")

    # Notifications aren't org-scoped (a user's notifications span every org they
    # belong to) — RLS here keys off app.current_user_id instead of
    # app.current_org_id, set by get_user_scoped_session (core/deps.py) rather than
    # the usual tenant-scoped session helper.
    op.execute("ALTER TABLE notifications ENABLE ROW LEVEL SECURITY")
    op.execute("ALTER TABLE notifications FORCE ROW LEVEL SECURITY")
    op.execute(
        """
        CREATE POLICY user_isolation ON notifications
        USING (recipient_id = current_setting('app.current_user_id', true)::uuid)
        """
    )

    # --- Admin cross-tenant aggregate functions (API Spec "GET /admin/storage/usage")
    # SECURITY DEFINER because documents/document_versions carry FORCE ROW LEVEL
    # SECURITY and an admin request has no single org's app.current_org_id set —
    # same escape-hatch pattern as the project/channel/message/task/document
    # bootstrap-lookup functions, but deliberately returns aggregates only, never
    # per-document rows. Authorization (system_admin + MFA) is enforced entirely at
    # the API layer before either function is ever called.
    op.execute(
        """
        CREATE FUNCTION get_total_storage_usage_bytes() RETURNS bigint
        LANGUAGE sql SECURITY DEFINER STABLE AS $$
            SELECT COALESCE(SUM(size_bytes), 0) FROM document_versions;
        $$
        """
    )
    op.execute("REVOKE ALL ON FUNCTION get_total_storage_usage_bytes() FROM PUBLIC")
    op.execute("GRANT EXECUTE ON FUNCTION get_total_storage_usage_bytes() TO app_role")

    op.execute(
        """
        CREATE FUNCTION get_storage_usage_by_org()
        RETURNS TABLE(organization_id uuid, total_bytes bigint)
        LANGUAGE sql SECURITY DEFINER STABLE AS $$
            SELECT d.organization_id, COALESCE(SUM(dv.size_bytes), 0)
            FROM documents d
            JOIN document_versions dv ON dv.document_id = d.id
            GROUP BY d.organization_id;
        $$
        """
    )
    op.execute("REVOKE ALL ON FUNCTION get_storage_usage_by_org() FROM PUBLIC")
    op.execute("GRANT EXECUTE ON FUNCTION get_storage_usage_by_org() TO app_role")


def downgrade() -> None:
    op.execute("DROP FUNCTION IF EXISTS get_storage_usage_by_org()")
    op.execute("DROP FUNCTION IF EXISTS get_total_storage_usage_bytes()")
    op.execute("DROP POLICY IF EXISTS user_isolation ON notifications")
    op.drop_table("notifications")
