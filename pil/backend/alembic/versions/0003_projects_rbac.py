"""phase 2: projects, project_members, project_partner_orgs, RLS

Revision ID: 0003
Revises: 0002
Create Date: 2026-07-20
"""
from collections.abc import Sequence

import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

from alembic import op

revision: str = "0003"
down_revision: str | None = "0002"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.create_table(
        "projects",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True, server_default=sa.text("gen_random_uuid()")),
        sa.Column(
            "organization_id", postgresql.UUID(as_uuid=True),
            sa.ForeignKey("organizations.id", ondelete="RESTRICT"), nullable=False,
        ),
        sa.Column("name", sa.String(150), nullable=False),
        sa.Column("description", sa.String, nullable=True),
        sa.Column("created_by", postgresql.UUID(as_uuid=True), sa.ForeignKey("users.id"), nullable=False),
        sa.Column("deleted_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
    )
    op.create_index("ix_projects_organization_id", "projects", ["organization_id"])

    op.create_table(
        "project_members",
        sa.Column(
            "project_id", postgresql.UUID(as_uuid=True),
            sa.ForeignKey("projects.id", ondelete="CASCADE"), primary_key=True,
        ),
        sa.Column("user_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("users.id", ondelete="CASCADE"), primary_key=True),
        sa.Column("organization_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("role", sa.String(30), nullable=False, server_default="member"),
        sa.Column("added_by", postgresql.UUID(as_uuid=True), sa.ForeignKey("users.id"), nullable=False),
        sa.Column("added_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
    )
    op.create_index("ix_project_members_organization_id", "project_members", ["organization_id"])
    op.create_index("ix_project_members_user_id", "project_members", ["user_id"])

    op.create_table(
        "project_partner_orgs",
        sa.Column(
            "project_id", postgresql.UUID(as_uuid=True),
            sa.ForeignKey("projects.id", ondelete="CASCADE"), primary_key=True,
        ),
        sa.Column(
            "organization_id", postgresql.UUID(as_uuid=True),
            sa.ForeignKey("organizations.id", ondelete="CASCADE"), primary_key=True,
        ),
        sa.Column("invited_by", postgresql.UUID(as_uuid=True), sa.ForeignKey("users.id"), nullable=False),
        sa.Column("invited_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
    )

    op.execute("GRANT SELECT, INSERT, UPDATE, DELETE ON projects TO app_role")
    op.execute("GRANT SELECT, INSERT, UPDATE, DELETE ON project_members TO app_role")
    op.execute("GRANT SELECT, INSERT, UPDATE, DELETE ON project_partner_orgs TO app_role")
    op.execute("GRANT SELECT ON projects, project_members, project_partner_orgs TO app_readonly_role")

    # A project-scoped request needs to learn which org owns a project BEFORE it can
    # set app.current_org_id — but projects will have FORCE ROW LEVEL SECURITY below,
    # which (correctly) blocks app_role from reading ANY row, including this one,
    # without that context already set. This is the standard Postgres escape hatch:
    # a SECURITY DEFINER function, owned by the migration role (not app_role), that
    # returns only the org id — never project content — bypassing RLS for exactly
    # this one minimal, non-sensitive lookup (see core/deps.py get_project_scoped_session
    # and repositories/project_repository.get_organization_id_for_project).
    op.execute(
        """
        CREATE FUNCTION get_project_organization_id(p_project_id uuid) RETURNS uuid
        LANGUAGE sql SECURITY DEFINER STABLE AS $$
            SELECT organization_id FROM projects WHERE id = p_project_id;
        $$
        """
    )
    op.execute("REVOKE ALL ON FUNCTION get_project_organization_id(uuid) FROM PUBLIC")
    op.execute("GRANT EXECUTE ON FUNCTION get_project_organization_id(uuid) TO app_role")

    # --- Row-Level Security (Database Design doc §4) ---
    # `projects` itself: a row is visible if it belongs to the caller's org, OR the
    # caller's org holds an explicit partner grant on it (Threat Model §2 trust
    # boundary 4 — cross-org access is never implicit).
    op.execute("ALTER TABLE projects ENABLE ROW LEVEL SECURITY")
    op.execute("ALTER TABLE projects FORCE ROW LEVEL SECURITY")
    op.execute(
        """
        CREATE POLICY tenant_isolation ON projects
        USING (
            organization_id = current_setting('app.current_org_id', true)::uuid
            OR id IN (
                SELECT project_id FROM project_partner_orgs
                WHERE organization_id = current_setting('app.current_org_id', true)::uuid
            )
        )
        """
    )

    op.execute("ALTER TABLE project_members ENABLE ROW LEVEL SECURITY")
    op.execute("ALTER TABLE project_members FORCE ROW LEVEL SECURITY")
    op.execute(
        """
        CREATE POLICY tenant_isolation ON project_members
        USING (
            organization_id = current_setting('app.current_org_id', true)::uuid
            OR project_id IN (
                SELECT project_id FROM project_partner_orgs
                WHERE organization_id = current_setting('app.current_org_id', true)::uuid
            )
        )
        """
    )

    op.execute("ALTER TABLE project_partner_orgs ENABLE ROW LEVEL SECURITY")
    op.execute("ALTER TABLE project_partner_orgs FORCE ROW LEVEL SECURITY")
    # Deliberately uses the SECURITY DEFINER function instead of a subquery against
    # `projects` directly. `projects`' own policy (above) queries project_partner_orgs
    # to check partner grants — a subquery here back into `projects` would make the
    # two policies mutually recursive, and Postgres raises
    # "infinite recursion detected in policy for relation" rather than evaluate it.
    # This was caught by actually running the test suite against live Postgres — no
    # amount of linting or type-checking can catch a circular RLS policy, since it's
    # a property of the query planner, not the Python/SQL text in isolation.
    op.execute(
        """
        CREATE POLICY tenant_isolation ON project_partner_orgs
        USING (
            organization_id = current_setting('app.current_org_id', true)::uuid
            OR get_project_organization_id(project_id) = current_setting('app.current_org_id', true)::uuid
        )
        """
    )


def downgrade() -> None:
    op.execute("DROP POLICY IF EXISTS tenant_isolation ON project_partner_orgs")
    op.execute("DROP POLICY IF EXISTS tenant_isolation ON project_members")
    op.execute("DROP POLICY IF EXISTS tenant_isolation ON projects")
    op.execute("DROP FUNCTION IF EXISTS get_project_organization_id(uuid)")
    op.drop_table("project_partner_orgs")
    op.drop_table("project_members")
    op.drop_table("projects")
