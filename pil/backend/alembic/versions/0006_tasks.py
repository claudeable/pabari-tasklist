"""phase 5: milestones, tasks, task_comments, task_attachments, announcements, RLS

Revision ID: 0006
Revises: 0005
Create Date: 2026-07-21
"""
from collections.abc import Sequence

import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

from alembic import op

revision: str = "0006"
down_revision: str | None = "0005"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.create_table(
        "milestones",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True, server_default=sa.text("gen_random_uuid()")),
        sa.Column("project_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("projects.id", ondelete="CASCADE"), nullable=False),
        sa.Column("organization_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("name", sa.String(150), nullable=False),
        sa.Column("due_date", sa.Date, nullable=True),
        sa.Column("created_by", postgresql.UUID(as_uuid=True), sa.ForeignKey("users.id"), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
    )
    op.create_index("ix_milestones_project_id", "milestones", ["project_id"])
    op.create_index("ix_milestones_organization_id", "milestones", ["organization_id"])

    op.create_table(
        "tasks",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True, server_default=sa.text("gen_random_uuid()")),
        sa.Column("project_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("projects.id", ondelete="CASCADE"), nullable=False),
        sa.Column("organization_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("title", sa.String(255), nullable=False),
        sa.Column("description", sa.Text, nullable=True),
        sa.Column("status", sa.String(30), nullable=False, server_default="todo"),
        sa.Column("priority", sa.String(20), nullable=False, server_default="medium"),
        sa.Column("assignee_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("users.id"), nullable=True),
        sa.Column("due_date", sa.Date, nullable=True),
        sa.Column("milestone_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("milestones.id"), nullable=True),
        sa.Column("created_by", postgresql.UUID(as_uuid=True), sa.ForeignKey("users.id"), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.Column("deleted_at", sa.DateTime(timezone=True), nullable=True),
        sa.CheckConstraint("status IN ('todo','in_progress','review','done')", name="ck_tasks_status"),
        sa.CheckConstraint("priority IN ('low','medium','high','critical')", name="ck_tasks_priority"),
    )
    op.create_index("ix_tasks_project_id", "tasks", ["project_id"])
    op.create_index("ix_tasks_organization_id", "tasks", ["organization_id"])

    op.create_table(
        "task_comments",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True, server_default=sa.text("gen_random_uuid()")),
        sa.Column("task_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("tasks.id", ondelete="CASCADE"), nullable=False),
        sa.Column("author_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("users.id"), nullable=False),
        sa.Column("body", sa.Text, nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
    )
    op.create_index("ix_task_comments_task_id", "task_comments", ["task_id"])

    op.create_table(
        "task_attachments",
        sa.Column("task_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("tasks.id", ondelete="CASCADE"), primary_key=True),
        sa.Column(
            "document_id", postgresql.UUID(as_uuid=True),
            sa.ForeignKey("documents.id", ondelete="CASCADE"), primary_key=True,
        ),
        sa.Column("added_by", postgresql.UUID(as_uuid=True), sa.ForeignKey("users.id"), nullable=False),
        sa.Column("added_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
    )

    op.create_table(
        "announcements",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True, server_default=sa.text("gen_random_uuid()")),
        sa.Column("project_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("projects.id", ondelete="CASCADE"), nullable=False),
        sa.Column("organization_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("author_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("users.id"), nullable=False),
        sa.Column("title", sa.String(255), nullable=False),
        sa.Column("body", sa.Text, nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
    )
    op.create_index("ix_announcements_project_id", "announcements", ["project_id"])
    op.create_index("ix_announcements_organization_id", "announcements", ["organization_id"])

    for table in ("milestones", "tasks", "task_comments", "task_attachments", "announcements"):
        op.execute(f"GRANT SELECT, INSERT, UPDATE, DELETE ON {table} TO app_role")
        op.execute(f"GRANT SELECT ON {table} TO app_readonly_role")

    op.execute(
        """
        CREATE FUNCTION get_task_organization_id(p_task_id uuid) RETURNS uuid
        LANGUAGE sql SECURITY DEFINER STABLE AS $$
            SELECT organization_id FROM tasks WHERE id = p_task_id;
        $$
        """
    )
    op.execute("REVOKE ALL ON FUNCTION get_task_organization_id(uuid) FROM PUBLIC")
    op.execute("GRANT EXECUTE ON FUNCTION get_task_organization_id(uuid) TO app_role")

    # --- Row-Level Security (Database Design doc §4) ---
    for table in ("milestones", "tasks", "announcements"):
        op.execute(f"ALTER TABLE {table} ENABLE ROW LEVEL SECURITY")
        op.execute(f"ALTER TABLE {table} FORCE ROW LEVEL SECURITY")
        # `table` is drawn from the fixed literal tuple above (never user input) —
        # this is a migration authored by us, run once at deploy time under the
        # migration role, not a runtime query path.
        policy_sql = f"""
            CREATE POLICY tenant_isolation ON {table}
            USING (
                organization_id = current_setting('app.current_org_id', true)::uuid
                OR project_id IN (
                    SELECT project_id FROM project_partner_orgs
                    WHERE organization_id = current_setting('app.current_org_id', true)::uuid
                )
            )
            """  # noqa: S608
        op.execute(policy_sql)

    op.execute("ALTER TABLE task_comments ENABLE ROW LEVEL SECURITY")
    op.execute("ALTER TABLE task_comments FORCE ROW LEVEL SECURITY")
    op.execute(
        """
        CREATE POLICY tenant_isolation ON task_comments
        USING (
            task_id IN (
                SELECT id FROM tasks
                WHERE organization_id = current_setting('app.current_org_id', true)::uuid
                   OR project_id IN (
                       SELECT project_id FROM project_partner_orgs
                       WHERE organization_id = current_setting('app.current_org_id', true)::uuid
                   )
            )
        )
        """
    )

    op.execute("ALTER TABLE task_attachments ENABLE ROW LEVEL SECURITY")
    op.execute("ALTER TABLE task_attachments FORCE ROW LEVEL SECURITY")
    op.execute(
        """
        CREATE POLICY tenant_isolation ON task_attachments
        USING (
            task_id IN (
                SELECT id FROM tasks
                WHERE organization_id = current_setting('app.current_org_id', true)::uuid
                   OR project_id IN (
                       SELECT project_id FROM project_partner_orgs
                       WHERE organization_id = current_setting('app.current_org_id', true)::uuid
                   )
            )
        )
        """
    )


def downgrade() -> None:
    for table in ("task_attachments", "task_comments", "announcements", "tasks", "milestones"):
        op.execute(f"DROP POLICY IF EXISTS tenant_isolation ON {table}")
    op.execute("DROP FUNCTION IF EXISTS get_task_organization_id(uuid)")
    op.drop_table("announcements")
    op.drop_table("task_attachments")
    op.drop_table("task_comments")
    op.drop_table("tasks")
    op.drop_table("milestones")
