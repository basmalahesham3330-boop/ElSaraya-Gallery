"""
Database engine and session management.

Provides:
- `engine`: the async SQLAlchemy engine used throughout the app.
- `AsyncSessionLocal`: a session factory for creating new sessions.
- `get_db`: a FastAPI dependency that yields a session per request and
  guarantees it is closed afterwards.

Commit policy
-------------
`get_db` does **not** auto-commit.  Services/repositories must call
`await session.commit()` explicitly (or rely on a Unit-of-Work helper).
This keeps write boundaries intentional and testable.
"""
from collections.abc import AsyncGenerator

from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker, create_async_engine

from app.core.config import settings

engine = create_async_engine(
    settings.DATABASE_URL,
    echo=settings.APP_DEBUG,
    pool_pre_ping=True,
)

AsyncSessionLocal = async_sessionmaker(
    bind=engine,
    class_=AsyncSession,
    expire_on_commit=False,
    autoflush=False,
)


async def get_db() -> AsyncGenerator[AsyncSession, None]:
    """
    FastAPI dependency that provides a request-scoped async DB session.
    
    Automatically commits on successful request completion.
    Rolls back on exceptions.
    """
    async with AsyncSessionLocal() as session:
        try:
            yield session
            # Auto-commit on successful request
            await session.commit()
        except Exception:
            await session.rollback()
            raise
