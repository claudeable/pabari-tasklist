"""task comment attachments + dedicated Harshil ("HK") comment field on tasks

Revision ID: 0014
Revises: 0013
Create Date: 2026-07-31

Task attachments deliberately reuse the `documents` table (unlike chat attachments in
migration 0013) — tasks have no DM-style privacy concept, they're already visible to
the whole project the same way Documents are, so there's no leak risk in reusing the
same org-scoped RLS. Attachment display metadata (filename/mime/size) is denormalized
onto task_comments to avoid an extra document+version join every time a task's
comment list is fetched, mirroring message_attachments' shape rather than documents'.

hk_comment/hk_comment_at on tasks is a single free-text field, gated at the API layer
to `settings.task_approver_alias` (same config-driven single-user gate already used
for "only Harshil can mark a task Resolved" in tasks.py update_task) — not a second
row in task_comments, since the ask is one persistent "Harshil's comment" per task,
not a running log.
"""
from collections.abc import Sequence

import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

from alembic import op

revision: str = "0014"
down_revision: str | None = "0013"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.add_column(
        "task_comments",
        sa.Column(
            "attachment_document_id",
            postgresql.UUID(as_uuid=True),
            sa.ForeignKey("documents.id", ondelete="SET NULL"),
            nullable=True,
        ),
    )
    op.add_column("task_comments", sa.Column("attachment_filename", sa.String(255), nullable=True))
    op.add_column("task_comments", sa.Column("attachment_mime_type", sa.String(150), nullable=True))
    op.add_column("task_comments", sa.Column("attachment_size_bytes", sa.BigInteger, nullable=True))

    op.add_column("tasks", sa.Column("hk_comment", sa.Text, nullable=True))
    op.add_column("tasks", sa.Column("hk_comment_at", sa.DateTime(timezone=True), nullable=True))


def downgrade() -> None:
    op.drop_column("tasks", "hk_comment_at")
    op.drop_column("tasks", "hk_comment")

    op.drop_column("task_comments", "attachment_size_bytes")
    op.drop_column("task_comments", "attachment_mime_type")
    op.drop_column("task_comments", "attachment_filename")
    op.drop_column("task_comments", "attachment_document_id")
