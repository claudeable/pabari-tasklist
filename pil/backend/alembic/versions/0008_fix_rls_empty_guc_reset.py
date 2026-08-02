"""fix RLS empty-string GUC reset bug

Revision ID: 0008
Revises: 0007
Create Date: 2026-07-22

Postgres resets a custom (undeclared) GUC set via `SET LOCAL` to '' (empty
string), not NULL, once the transaction that set it commits or rolls back —
this is a documented quirk of custom run-time parameters, which have no true
"unset" state once referenced. Since the app's connection pool reuses physical
connections across unrelated requests, any pooled connection that has EVER
served a tenant-scoped request (get_org_scoped_session, get_project_scoped_session,
etc.) will thereafter return '' instead of NULL from
`current_setting('app.current_org_id', true)` on any later request that does
NOT set its own org context (e.g. GET /organizations, which legitimately spans
every org a user belongs to). Casting '' to uuid raises
`invalid input syntax for type uuid: ""`, crashing the request.

Fix: route every policy's context lookup through a STABLE SQL function that
NULLIFs the empty string before casting, so both "never set" and "reset after
a prior scoped use" are treated identically as "no context" (RLS then hides
all rows, which is the correct fail-closed behavior for an unscoped query).
"""
from collections.abc import Sequence

from alembic import op

revision: str = "0008"
down_revision: str | None = "0007"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None

_POLICIES: list[tuple[str, str, str]] = [
    (
        "organization_members",
        "tenant_isolation",
        "organization_id = app_current_org_id()",
    ),
    (
        "projects",
        "tenant_isolation",
        """organization_id = app_current_org_id()
           OR id IN (SELECT project_partner_orgs.project_id FROM project_partner_orgs
                     WHERE project_partner_orgs.organization_id = app_current_org_id())""",
    ),
    (
        "project_members",
        "tenant_isolation",
        """organization_id = app_current_org_id()
           OR project_id IN (SELECT project_partner_orgs.project_id FROM project_partner_orgs
                              WHERE project_partner_orgs.organization_id = app_current_org_id())""",
    ),
    (
        "project_partner_orgs",
        "tenant_isolation",
        "organization_id = app_current_org_id() OR get_project_organization_id(project_id) = app_current_org_id()",
    ),
    (
        "channels",
        "tenant_isolation",
        """organization_id = app_current_org_id()
           OR project_id IN (SELECT project_partner_orgs.project_id FROM project_partner_orgs
                              WHERE project_partner_orgs.organization_id = app_current_org_id())""",
    ),
    (
        "messages",
        "tenant_isolation",
        """organization_id = app_current_org_id()
           OR channel_id IN (
               SELECT c.id FROM channels c
               JOIN project_partner_orgs ppo ON ppo.project_id = c.project_id
               WHERE ppo.organization_id = app_current_org_id()
           )""",
    ),
    (
        "message_reads",
        "tenant_isolation",
        """message_id IN (SELECT messages.id FROM messages
                          WHERE messages.organization_id = app_current_org_id())""",
    ),
    (
        "message_search_index",
        "tenant_isolation",
        "organization_id = app_current_org_id()",
    ),
    (
        "documents",
        "tenant_isolation",
        """organization_id = app_current_org_id()
           OR project_id IN (SELECT project_partner_orgs.project_id FROM project_partner_orgs
                              WHERE project_partner_orgs.organization_id = app_current_org_id())""",
    ),
    (
        "document_versions",
        "tenant_isolation",
        """document_id IN (
               SELECT documents.id FROM documents
               WHERE documents.organization_id = app_current_org_id()
                  OR documents.project_id IN (
                      SELECT project_partner_orgs.project_id FROM project_partner_orgs
                      WHERE project_partner_orgs.organization_id = app_current_org_id()
                  )
           )""",
    ),
    (
        "document_search_index",
        "tenant_isolation",
        "organization_id = app_current_org_id()",
    ),
    (
        "milestones",
        "tenant_isolation",
        """organization_id = app_current_org_id()
           OR project_id IN (SELECT project_partner_orgs.project_id FROM project_partner_orgs
                              WHERE project_partner_orgs.organization_id = app_current_org_id())""",
    ),
    (
        "tasks",
        "tenant_isolation",
        """organization_id = app_current_org_id()
           OR project_id IN (SELECT project_partner_orgs.project_id FROM project_partner_orgs
                              WHERE project_partner_orgs.organization_id = app_current_org_id())""",
    ),
    (
        "announcements",
        "tenant_isolation",
        """organization_id = app_current_org_id()
           OR project_id IN (SELECT project_partner_orgs.project_id FROM project_partner_orgs
                              WHERE project_partner_orgs.organization_id = app_current_org_id())""",
    ),
    (
        "task_comments",
        "tenant_isolation",
        """task_id IN (
               SELECT tasks.id FROM tasks
               WHERE tasks.organization_id = app_current_org_id()
                  OR tasks.project_id IN (
                      SELECT project_partner_orgs.project_id FROM project_partner_orgs
                      WHERE project_partner_orgs.organization_id = app_current_org_id()
                  )
           )""",
    ),
    (
        "task_attachments",
        "tenant_isolation",
        """task_id IN (
               SELECT tasks.id FROM tasks
               WHERE tasks.organization_id = app_current_org_id()
                  OR tasks.project_id IN (
                      SELECT project_partner_orgs.project_id FROM project_partner_orgs
                      WHERE project_partner_orgs.organization_id = app_current_org_id()
                  )
           )""",
    ),
    (
        "notifications",
        "user_isolation",
        "recipient_id = app_current_user_id()",
    ),
]


def upgrade() -> None:
    op.execute(
        """
        CREATE OR REPLACE FUNCTION app_current_org_id() RETURNS uuid AS $$
            SELECT NULLIF(current_setting('app.current_org_id', true), '')::uuid
        $$ LANGUAGE sql STABLE
        """
    )
    op.execute(
        """
        CREATE OR REPLACE FUNCTION app_current_user_id() RETURNS uuid AS $$
            SELECT NULLIF(current_setting('app.current_user_id', true), '')::uuid
        $$ LANGUAGE sql STABLE
        """
    )
    for table, policy, using_expr in _POLICIES:
        op.execute(f'DROP POLICY IF EXISTS "{policy}" ON "{table}"')
        op.execute(f'CREATE POLICY "{policy}" ON "{table}" USING ({using_expr})')


def downgrade() -> None:
    # Not reverting to the raw current_setting(...)::uuid form — that form is the
    # bug this migration fixes, not a legitimate alternate state to roll back to.
    raise NotImplementedError("0008 is not reversible: downgrading would reintroduce the empty-string GUC crash")
