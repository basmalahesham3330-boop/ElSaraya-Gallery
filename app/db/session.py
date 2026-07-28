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

# Configure connection arguments based on environment
connect_args = {}

# Enable SSL for Railway or production environments
if settings.is_railway or (settings.APP_ENV == "production" and "railway" in settings.DATABASE_URL.lower()):
    connect_args["ssl"] = "require"

# DIAGNOSTIC: Print FastAPI engine configuration
print("=" * 60)
print("FASTAPI ENGINE CONFIG")
print("=" * 60)
try:
    from sqlalchemy.engine import make_url
    
    url = make_url(settings.DATABASE_URL)
    print(f"\nDriver:   {url.drivername}")
    print(f"Host:     {url.host}")
    print(f"Port:     {url.port}")
    print(f"Database: {url.database}")
    print(f"Username: {url.username}")
    print(f"SSL enabled: {bool(connect_args.get('ssl'))}")
    print(f"\nRaw URL (masked): {settings._mask_password(settings.DATABASE_URL)}")
except Exception as e:
    print(f"\nERROR parsing DATABASE_URL: {e}")
    print(f"Raw value (masked): {settings._mask_password(settings.DATABASE_URL)}")
    print(f"SSL enabled: {bool(connect_args.get('ssl'))}")
print("=" * 60)

engine = create_async_engine(
    settings.DATABASE_URL,
    echo=settings.APP_DEBUG,
    pool_pre_ping=True,
    connect_args=connect_args,
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
