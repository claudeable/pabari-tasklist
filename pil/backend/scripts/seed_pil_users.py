"""
Seed PIL Transmission Lines users.

Run from the PIL backend root:
    python scripts/seed_pil_users.py

Creates:
  - SSO users (linked to Pabari ERP via pabari_email)
  - Alias-only users (falcon-01, falcon-02)

All users get password: changeme123
must_change_password is set to False so they can log in immediately.
"""

import asyncio
import os
import sys

# Allow running from either the repo root or the scripts/ directory
sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession, create_async_engine, async_sessionmaker

from app.core.config import Settings
from app.core.security.passwords import hash_password
from app.domain.models.user import User
from app.domain.enums import SystemRole, UserStatus

PASSWORD = "changeme123"

# (alias, pabari_email or None, display note)
USERS_TO_CREATE = [
    # SSO users — pabari_email must match what Pabari ERP returns for that user
    ("admin",     "admin@usm.co.ke",             "Admin (SSO)"),
    ("bnzuka",    "bnzuka@usm.co.ke",             "Benson (SSO)"),
    ("pmureithi", "pmureithi@usm.co.ke",          "Paul (SSO)"),
    ("yaynalem",  "yaynalem@usm.co.ke",           "Yalelet (SSO)"),
    ("hkotecha",  "hkotecha@kwale-group.com",     "Harshil (SSO)"),
    # Alias-only users — direct login only, no SSO
    ("falcon-01", None,                           "Falcon 01 (alias)"),
    ("falcon-02", None,                           "Falcon 02 (alias)"),
]


async def main() -> None:
    settings = Settings()
    engine = create_async_engine(settings.database_url, pool_pre_ping=True)
    factory = async_sessionmaker(engine, expire_on_commit=False, autoflush=False)

    async with factory() as session:
        async with session.begin():
            for alias, pabari_email, note in USERS_TO_CREATE:
                # Check if alias already exists
                existing = (await session.execute(
                    select(User).where(User.alias == alias)
                )).scalar_one_or_none()

                if existing is not None:
                    print(f"  SKIP   {alias:<14}  (alias already exists)")
                    continue

                # Check if pabari_email already exists (for SSO users)
                if pabari_email:
                    existing_email = (await session.execute(
                        select(User).where(User.pabari_email == pabari_email)
                    )).scalar_one_or_none()
                    if existing_email is not None:
                        print(f"  SKIP   {alias:<14}  (pabari_email already linked to {existing_email.alias})")
                        continue

                user = User(
                    alias=alias,
                    pabari_email=pabari_email,
                    password_hash=hash_password(PASSWORD),
                    system_role=SystemRole.member.value,
                    status=UserStatus.active.value,
                    must_change_password=False,
                )
                session.add(user)
                print(f"  CREATE {alias:<14}  — {note}")

    print("\nDone.")
    await engine.dispose()


if __name__ == "__main__":
    asyncio.run(main())
