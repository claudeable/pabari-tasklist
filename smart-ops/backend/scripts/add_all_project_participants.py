"""One-time backfill: every registered user in every existing project.

Run from the backend directory: python scripts/add_all_project_participants.py
Existing assignments are preserved. No emails are generated.
"""

import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

import app.db.base  # noqa: E402,F401
from sqlalchemy import text
from app.db.session import SessionLocal


def add_all_participants(db):
    # Serialize backfills and manual participant writes while checking duplicates.
    db.execute(text("LOCK TABLE project_participants IN SHARE ROW EXCLUSIVE MODE"))
    result = db.execute(text("""
        INSERT INTO project_participants (id, project_id, organization_id, user_id)
        SELECT gen_random_uuid(), p.id, u.organization_id, u.id
        FROM projects p CROSS JOIN users u
        WHERE NOT EXISTS (
            SELECT 1 FROM project_participants existing
            WHERE existing.project_id = p.id AND existing.user_id = u.id
        )
    """))
    added = result.rowcount
    missing = db.execute(text("""
        SELECT count(*) FROM projects p CROSS JOIN users u
        WHERE NOT EXISTS (
            SELECT 1 FROM project_participants existing
            WHERE existing.project_id = p.id AND existing.user_id = u.id
        )
    """)).scalar_one()
    if missing:
        raise RuntimeError(f"Participant verification failed: {missing} missing assignments")
    return added


if __name__ == "__main__":
    with SessionLocal.begin() as db:
        added = add_all_participants(db)
    print(f"Added {added} participant assignments; verified all users belong to all existing projects.")
