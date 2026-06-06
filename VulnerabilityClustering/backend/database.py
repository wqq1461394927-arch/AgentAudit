"""Database connection and session management."""
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker, create_async_engine
from sqlalchemy.orm import DeclarativeBase

from .config import settings

_engine = None
_async_session = None


def async_session():
    """Return the current async sessionmaker (lazy-initialized)."""
    return _get_async_session()


class Base(DeclarativeBase):
    pass


def _get_engine():
    global _engine
    if _engine is None:
        if not settings.database_url:
            raise RuntimeError(
                "DATABASE_URL is not configured. Set the database_url in config "
                "or via the DATABASE_URL environment variable."
            )
        _engine = create_async_engine(settings.database_url, echo=False)
    return _engine


def _get_async_session():
    global _async_session
    if _async_session is None:
        _async_session = async_sessionmaker(
            _get_engine(), class_=AsyncSession, expire_on_commit=False
        )
    return _async_session


async def get_db() -> AsyncSession:
    async with _get_async_session()() as session:
        try:
            yield session
        finally:
            await session.close()


async def init_db():
    """Create all tables."""
    async with _get_engine().begin() as conn:
        await conn.run_sync(Base.metadata.create_all)
