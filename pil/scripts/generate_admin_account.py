#!/usr/bin/env python3
"""Bootstrap the first System Administrator account.

This is the ONLY way to create the very first account — there is no self-registration
endpoint anywhere in the API (Authentication Design doc §1). Subsequent accounts are
created by an existing System Administrator via the admin panel/API.

Usage (from backend/ with the venv active, DATABASE_URL set):
    python ../scripts/generate_admin_account.py --alias Falcon-01

Generates a one-time random password, prints it ONCE to stdout for the operator to
relay out-of-band, and forces a password change (and MFA enrollment) on first login.
"""

from __future__ import annotations

import argparse
import asyncio
import secrets
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent / "backend"))

from sqlalchemy import select  # noqa: E402
from sqlalchemy.ext.asyncio import create_async_engine  # noqa: E402
from sqlalchemy.orm import sessionmaker  # noqa: E402
from sqlalchemy.ext.asyncio import AsyncSession  # noqa: E402

from app.core.config import get_settings  # noqa: E402
from app.core.security.passwords import hash_password  # noqa: E402
from app.domain.enums import SystemRole  # noqa: E402
from app.domain.models.user import User  # noqa: E402


def generate_one_time_password() -> str:
    # 24 bytes of entropy, URL-safe alphabet — well above the 14-char minimum and not
    # subject to any human-memorability constraint since it must be changed immediately.
    return secrets.token_urlsafe(24)


async def create_admin(alias: str) -> None:
    settings = get_settings()
    engine = create_async_engine(settings.database_url)
    session_factory = sessionmaker(engine, class_=AsyncSession, expire_on_commit=False)

    async with session_factory() as session:
        existing = await session.execute(select(User).where(User.alias == alias))
        if existing.scalar_one_or_none() is not None:
            print(f"Error: alias '{alias}' already exists.", file=sys.stderr)
            sys.exit(1)

        one_time_password = generate_one_time_password()
        user = User(
            alias=alias,
            password_hash=hash_password(one_time_password),
            system_role=SystemRole.system_admin.value,
            must_change_password=True,
        )
        session.add(user)
        await session.commit()

    await engine.dispose()

    print("=" * 72)
    print(f"System Administrator account created: {alias}")
    print(f"One-time password: {one_time_password}")
    print("This password is shown ONCE. Relay it to the operator out-of-band")
    print("(never via email/chat on this platform). It must be changed and MFA")
    print("enrolled (WebAuthn required for System Administrator) on first login.")
    print("=" * 72)


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--alias", required=True, help="Alias for the new admin, e.g. Falcon-01")
    args = parser.parse_args()
    asyncio.run(create_admin(args.alias))


if __name__ == "__main__":
    main()
