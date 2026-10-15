"""Backfill all users/projects and keep future registrations/projects assigned."""

from alembic import op

revision = "0013"
down_revision = "0012"
branch_labels = None
depends_on = None


def upgrade():
    op.execute("LOCK TABLE users, projects, project_participants IN SHARE ROW EXCLUSIVE MODE")
    op.execute("""
        INSERT INTO project_participants (id, project_id, organization_id, user_id)
        SELECT gen_random_uuid(), p.id, u.organization_id, u.id
        FROM projects p CROSS JOIN users u
        WHERE NOT EXISTS (SELECT 1 FROM project_participants pp
            WHERE pp.project_id = p.id AND pp.user_id = u.id)
    """)
    op.execute("""
        CREATE FUNCTION auto_assign_project_participants() RETURNS trigger AS $$
        BEGIN
            PERFORM pg_advisory_xact_lock(623613);
            IF TG_TABLE_NAME = 'users' THEN
                INSERT INTO project_participants (id, project_id, organization_id, user_id)
                SELECT gen_random_uuid(), p.id, NEW.organization_id, NEW.id FROM projects p
                WHERE NOT EXISTS (SELECT 1 FROM project_participants pp
                    WHERE pp.project_id = p.id AND pp.user_id = NEW.id);
            ELSE
                INSERT INTO project_participants (id, project_id, organization_id, user_id)
                SELECT gen_random_uuid(), NEW.id, u.organization_id, u.id FROM users u
                WHERE NOT EXISTS (SELECT 1 FROM project_participants pp
                    WHERE pp.project_id = NEW.id AND pp.user_id = u.id);
            END IF;
            RETURN NEW;
        END;
        $$ LANGUAGE plpgsql;
        CREATE TRIGGER auto_assign_new_user AFTER INSERT ON users
            FOR EACH ROW EXECUTE FUNCTION auto_assign_project_participants();
        CREATE TRIGGER auto_assign_new_project AFTER INSERT ON projects
            FOR EACH ROW EXECUTE FUNCTION auto_assign_project_participants();
    """)


def downgrade():
    op.execute("DROP TRIGGER IF EXISTS auto_assign_new_user ON users")
    op.execute("DROP TRIGGER IF EXISTS auto_assign_new_project ON projects")
    op.execute("DROP FUNCTION IF EXISTS auto_assign_project_participants()")
    # Preserve participant assignments: some may have been added manually.
