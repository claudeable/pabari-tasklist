"""fix notifications RLS: INSERT was blocked for any recipient other than the caller

Revision ID: 0012
Revises: 0011
Create Date: 2026-07-31

A notification is inherently written by one user (or the app, on behalf of an
event) FOR a different user — that's the entire point of the feature. The
original policy had no FOR clause, so it defaulted to governing INSERT too,
requiring recipient_id = app_current_user_id() (the person taking the action,
e.g. sending a message), which can never equal the notification's actual
recipient (the person being notified). This broke every notification type
that ever existed here (task assignment, mentions, new message) — none of
them were ever actually exercised end-to-end until now.

Fix: split into a read/write-your-own policy (SELECT/UPDATE/DELETE, unchanged
restriction — a user still only ever sees or marks read their own
notifications) and a separate, permissive INSERT check — same pattern already
used for security_events (broad INSERT, restricted reads).
"""
from collections.abc import Sequence

from alembic import op

revision: str = "0012"
down_revision: str | None = "0011"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    # Postgres CREATE POLICY's FOR clause takes exactly one command, not a list —
    # each command that needs its own rule gets its own policy statement.
    op.execute('DROP POLICY IF EXISTS "user_isolation" ON "notifications"')
    op.execute(
        """
        CREATE POLICY "user_isolation_select" ON "notifications"
        FOR SELECT USING (recipient_id = app_current_user_id())
        """
    )
    op.execute(
        """
        CREATE POLICY "user_isolation_update" ON "notifications"
        FOR UPDATE
        USING (recipient_id = app_current_user_id())
        WITH CHECK (recipient_id = app_current_user_id())
        """
    )
    op.execute(
        """
        CREATE POLICY "user_isolation_delete" ON "notifications"
        FOR DELETE USING (recipient_id = app_current_user_id())
        """
    )
    op.execute(
        """
        CREATE POLICY "user_isolation_insert" ON "notifications"
        FOR INSERT WITH CHECK (true)
        """
    )


def downgrade() -> None:
    op.execute('DROP POLICY IF EXISTS "user_isolation_insert" ON "notifications"')
    op.execute('DROP POLICY IF EXISTS "user_isolation_delete" ON "notifications"')
    op.execute('DROP POLICY IF EXISTS "user_isolation_update" ON "notifications"')
    op.execute('DROP POLICY IF EXISTS "user_isolation_select" ON "notifications"')
    op.execute(
        """
        CREATE POLICY "user_isolation" ON "notifications"
        USING (recipient_id = app_current_user_id())
        """
    )
