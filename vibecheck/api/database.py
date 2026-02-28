from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker, create_async_engine
from sqlalchemy.orm import declarative_base
from sqlalchemy.pool import NullPool

from api.config import settings

engine_kwargs = {
    "echo": settings.DEBUG,
    "pool_pre_ping": True,
}

# Supabase pooler / PgBouncer in transaction mode does not support prepared
# statements reliably. Disable asyncpg statement cache and avoid persistent
# pooled connections at SQLAlchemy layer for these URLs.
if (
    "pooler.supabase.com" in settings.DATABASE_URL
    or "pgbouncer" in settings.DATABASE_URL.lower()
):
    engine_kwargs["connect_args"] = {"statement_cache_size": 0}
    engine_kwargs["poolclass"] = NullPool

engine = create_async_engine(settings.DATABASE_URL, **engine_kwargs)

async_sessionmaker_factory = async_sessionmaker(
    engine,
    class_=AsyncSession,
    expire_on_commit=False,
    autocommit=False,
    autoflush=False,
)

Base = declarative_base()


async def get_db():
    async with async_sessionmaker_factory() as session:
        try:
            yield session
            await session.commit()
        except Exception:
            await session.rollback()
            raise
        finally:
            await session.close()


async def create_tables():
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)
