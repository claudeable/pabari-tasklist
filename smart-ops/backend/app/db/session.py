from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import NullPool

from app.core.config import settings

# NullPool: each serverless invocation gets a fresh connection rather than
# holding a stale pooled one across cold starts. Pair with Neon's pooled
# (pgbouncer) connection string in production.
engine = create_engine(settings.DATABASE_URL, pool_pre_ping=True, future=True, poolclass=NullPool)

SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine, future=True)
