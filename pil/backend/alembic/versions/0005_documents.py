"""phase 4: documents, document_versions, document_search_index, RLS

Revision ID: 0005
Revises: 0004
Create Date: 2026-07-21
"""
from collections.abc import Sequence

import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

from alembic import op

revision: str = "0005"
down_revision: str | None = "0004"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.create_table(
        "document_versions",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True, server_default=sa.text("gen_random_uuid()")),
        sa.Column("document_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("version_number", sa.Integer, nullable=False),
        sa.Column("storage_key", sa.String(255), nullable=False, unique=True),
        sa.Column("encrypted_dek", sa.String, nullable=False),
        sa.Column("file_hash_sha256", sa.CHAR(64), nullable=False),
        sa.Column("size_bytes", sa.BigInteger, nullable=False),
        sa.Column("mime_type", sa.String(150), nullable=False),
        sa.Column("original_filename", sa.String(255), nullable=False),
        sa.Column("scan_status", sa.String(20), nullable=False, server_default="pending"),
        sa.Column("uploaded_by", postgresql.UUID(as_uuid=True), sa.ForeignKey("users.id"), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.UniqueConstraint("document_id", "version_number", name="uq_document_versions_document_version"),
    )
    op.create_index("ix_document_versions_document_id", "document_versions", ["document_id"])

    op.create_table(
        "documents",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True, server_default=sa.text("gen_random_uuid()")),
        sa.Column("project_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("projects.id", ondelete="CASCADE"), nullable=False),
        sa.Column("organization_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("folder_path", sa.String(500), nullable=False, server_default="/"),
        sa.Column("name", sa.String(255), nullable=False),
        sa.Column("current_version_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("document_versions.id"), nullable=True),
        sa.Column("status", sa.String(20), nullable=False, server_default="draft"),
        sa.Column("checked_out_by", postgresql.UUID(as_uuid=True), sa.ForeignKey("users.id"), nullable=True),
        sa.Column("checked_out_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("created_by", postgresql.UUID(as_uuid=True), sa.ForeignKey("users.id"), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.Column("deleted_at", sa.DateTime(timezone=True), nullable=True),
    )
    op.create_index("ix_documents_project_id", "documents", ["project_id"])
    op.create_index("ix_documents_organization_id", "documents", ["organization_id"])

    op.create_foreign_key(
        "fk_document_versions_document_id", "document_versions", "documents", ["document_id"], ["id"], ondelete="CASCADE"
    )

    op.create_table(
        "document_search_index",
        sa.Column(
            "document_id", postgresql.UUID(as_uuid=True),
            sa.ForeignKey("documents.id", ondelete="CASCADE"), primary_key=True,
        ),
        sa.Column("organization_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("project_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("tsv", postgresql.TSVECTOR, nullable=False),
    )
    op.create_index("ix_document_search_index_organization_id", "document_search_index", ["organization_id"])
    op.create_index("ix_document_search_index_project_id", "document_search_index", ["project_id"])
    op.execute("CREATE INDEX ix_document_search_index_tsv ON document_search_index USING GIN (tsv)")

    for table in ("documents", "document_versions", "document_search_index"):
        op.execute(f"GRANT SELECT, INSERT, UPDATE, DELETE ON {table} TO app_role")
        op.execute(f"GRANT SELECT ON {table} TO app_readonly_role")

    # document_versions has no organization_id column of its own (it inherits its
    # tenant via documents.organization_id) — the bootstrap lookup goes through
    # documents, keyed by document_id, same pattern as channels/messages/projects.
    op.execute(
        """
        CREATE FUNCTION get_document_organization_id(p_document_id uuid) RETURNS uuid
        LANGUAGE sql SECURITY DEFINER STABLE AS $$
            SELECT organization_id FROM documents WHERE id = p_document_id;
        $$
        """
    )
    op.execute("REVOKE ALL ON FUNCTION get_document_organization_id(uuid) FROM PUBLIC")
    op.execute("GRANT EXECUTE ON FUNCTION get_document_organization_id(uuid) TO app_role")

    # --- Row-Level Security (Database Design doc §4) ---
    op.execute("ALTER TABLE documents ENABLE ROW LEVEL SECURITY")
    op.execute("ALTER TABLE documents FORCE ROW LEVEL SECURITY")
    op.execute(
        """
        CREATE POLICY tenant_isolation ON documents
        USING (
            organization_id = current_setting('app.current_org_id', true)::uuid
            OR project_id IN (
                SELECT project_id FROM project_partner_orgs
                WHERE organization_id = current_setting('app.current_org_id', true)::uuid
            )
        )
        """
    )

    op.execute("ALTER TABLE document_versions ENABLE ROW LEVEL SECURITY")
    op.execute("ALTER TABLE document_versions FORCE ROW LEVEL SECURITY")
    op.execute(
        """
        CREATE POLICY tenant_isolation ON document_versions
        USING (
            document_id IN (
                SELECT id FROM documents
                WHERE organization_id = current_setting('app.current_org_id', true)::uuid
                   OR project_id IN (
                       SELECT project_id FROM project_partner_orgs
                       WHERE organization_id = current_setting('app.current_org_id', true)::uuid
                   )
            )
        )
        """
    )

    op.execute("ALTER TABLE document_search_index ENABLE ROW LEVEL SECURITY")
    op.execute("ALTER TABLE document_search_index FORCE ROW LEVEL SECURITY")
    op.execute(
        """
        CREATE POLICY tenant_isolation ON document_search_index
        USING (organization_id = current_setting('app.current_org_id', true)::uuid)
        """
    )


def downgrade() -> None:
    for table in ("document_search_index", "document_versions", "documents"):
        op.execute(f"DROP POLICY IF EXISTS tenant_isolation ON {table}")
    op.execute("DROP FUNCTION IF EXISTS get_document_organization_id(uuid)")
    op.drop_table("document_search_index")
    op.drop_constraint("fk_document_versions_document_id", "document_versions", type_="foreignkey")
    op.drop_table("documents")
    op.drop_table("document_versions")
