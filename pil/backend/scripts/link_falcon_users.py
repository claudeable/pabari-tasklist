"""
Link falcon-01 and falcon-02 PIL alias accounts to their Pabari workspace identities.

Their Pabari 'email' is just the alias itself (falcon-01, falcon-02),
so pabari_email in PIL must match that.

Run in the PIL backend Railway console:
    python scripts/link_falcon_users.py
"""

import asyncio
from sqlalchemy import text
from sqlalchemy.ext.asyncio import create_async_engine, async_sessionmaker
from app.core.config import Settings

LINKS = [
    ("falcon-01", "falcon-01"),
    ("falcon-02", "falcon-02"),
]

async def main() -> None:
    settings = Settings()
    engine = create_async_engine(settings.database_url)
    async with async_sessionmaker(engine)() as session:
        async with session.begin():
            for alias, pabari_email in LINKS:
                result = await session.execute(
                    text("UPDATE users SET pabari_email = :e WHERE alias = :a RETURNING alias"),
                    {"e": pabari_email, "a": alias}
                )
                row = result.fetchone()
                if row:
                    print(f"  LINKED {alias} → pabari_email={pabari_email}")
                else:
                    print(f"  NOT FOUND: {alias}")
    await engine.dispose()
    print("\nDone.")

asyncio.run(main())
