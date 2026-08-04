"""
Set up the PIL Transmission Lines organization.

Run in the PIL backend Railway console:
    python scripts/setup_org.py

This script:
  1. Promotes 'admin' user to system_admin
  2. Creates the 'PIL Transmission Lines' organization
  3. Adds all seeded users as members (admin = org_admin, others = member)
"""

import asyncio
import os
import uuid

from sqlalchemy import text, select
from sqlalchemy.ext.asyncio import create_async_engine, async_sessionmaker

DATABASE_URL = os.environ["DATABASE_URL"]

ORG_NAME = "PIL Transmission Lines"

# Members to add: (alias, org_role)
MEMBERS = [
    ("admin",     "org_admin"),
    ("bnzuka",    "member"),
    ("pmureithi", "member"),
    ("yaynalem",  "member"),
    ("hkotecha",  "member"),
    ("falcon-01", "member"),
    ("falcon-02", "member"),
]


async def main() -> None:
    engine = create_async_engine(DATABASE_URL, pool_pre_ping=True)
    async with async_sessionmaker(engine, expire_on_commit=False)() as s:
        async with s.begin():

            # 1. Promote admin to system_admin
            r = await s.execute(
                text("UPDATE users SET system_role='system_admin' WHERE alias='admin' RETURNING id, alias")
            )
            row = r.fetchone()
            if row:
                admin_id = row[0]
                print(f"  PROMOTED admin → system_admin  (id={admin_id})")
            else:
                row = (await s.execute(text("SELECT id FROM users WHERE alias='admin'"))).fetchone()
                admin_id = row[0] if row else None
                print(f"  admin already promoted or missing  (id={admin_id})")

            if not admin_id:
                print("ERROR: admin user not found — run seed_pil_users.py first")
                return

            # 2. Check if org already exists
            existing = (await s.execute(
                text("SELECT id FROM organizations WHERE name = :n"), {"n": ORG_NAME}
            )).fetchone()

            if existing:
                org_id = existing[0]
                print(f"  ORG already exists: {ORG_NAME}  (id={org_id})")
            else:
                org_id = uuid.uuid4()
                await s.execute(text("""
                    INSERT INTO organizations (id, name, slug, status)
                    VALUES (:id, :name, :slug, 'active')
                """), {"id": org_id, "name": ORG_NAME, "slug": "pil-transmission-lines"})
                print(f"  CREATED org: {ORG_NAME}  (id={org_id})")

            # 3. Add members
            for alias, org_role in MEMBERS:
                user_row = (await s.execute(
                    text("SELECT id FROM users WHERE alias = :a"), {"a": alias}
                )).fetchone()
                if not user_row:
                    print(f"  SKIP   {alias:<14}  (user not found)")
                    continue
                user_id = user_row[0]

                existing_member = (await s.execute(text("""
                    SELECT 1 FROM organization_members
                    WHERE organization_id = :o AND user_id = :u
                """), {"o": org_id, "u": user_id})).fetchone()

                if existing_member:
                    print(f"  SKIP   {alias:<14}  (already a member)")
                else:
                    await s.execute(text("""
                        INSERT INTO organization_members (organization_id, user_id, role)
                        VALUES (:o, :u, :r)
                    """), {"o": org_id, "u": user_id, "r": org_role})
                    print(f"  ADDED  {alias:<14}  → {org_role}")

    await engine.dispose()
    print("\nDone. Refresh the PIL portal — 'Permission denied' should be gone.")


asyncio.run(main())
