"""fix organization_members RLS so a user can list their own orgs

Revision ID: 0011
Revises: 0010
Create Date: 2026-07-30

`GET /organizations` (list every org a user belongs to) used a plain, untenanted
session — no app.current_org_id is set, because the whole point of the query is
to discover which org(s) to scope to next. But organization_members' RLS policy
required organization_id = app_current_org_id(), which is NULL on an untenanted
session, so this query silently returned zero rows for every single caller,
regardless of real membership. The frontend then always concluded "no org yet"
and created a brand new one — every teammate who logged in via the browser
ended up in their own isolated duplicate workspace instead of the shared one.

Fix: a user reading their OWN membership rows is not a tenant-isolation
concern (it's exactly analogous to `messages.author_id = me`), so add an
OR user_id = app_current_user_id() branch. The endpoint also switches to a
session that sets app.current_user_id (see api/v1/organizations.py).
"""
from collections.abc import Sequence

from alembic import op

revision: str = "0011"
down_revision: str | None = "0010"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.execute('DROP POLICY IF EXISTS "tenant_isolation" ON "organization_members"')
    op.execute(
        """
        CREATE POLICY "tenant_isolation" ON "organization_members"
        USING (organization_id = app_current_org_id() OR user_id = app_current_user_id())
        """
    )


def downgrade() -> None:
    op.execute('DROP POLICY IF EXISTS "tenant_isolation" ON "organization_members"')
    op.execute(
        """
        CREATE POLICY "tenant_isolation" ON "organization_members"
        USING (organization_id = app_current_org_id())
        """
    )
