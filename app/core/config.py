"""
Application configuration.

Settings are loaded from environment variables (and a local .env file
during development) using pydantic-settings. Import `settings` anywhere
in the application to access configuration values.

Only DATABASE_URL needs to be set. It can be in any of these forms:
  - postgresql://...          (plain, e.g. from Railway's default injection)
  - postgresql+asyncpg://...  (explicit async driver)

DATABASE_URL_SYNC is always derived automatically by swapping the driver
prefix to +psycopg, so it never needs to appear in .env or Railway vars.
"""
import os
from functools import lru_cache

from pydantic_settings import BaseSettings, SettingsConfigDict

# Async driver prefix used by SQLAlchemy's create_async_engine
_ASYNC_PREFIX = "postgresql+asyncpg://"
# Sync driver prefix used by Alembic
_SYNC_PREFIX = "postgresql+psycopg://"


def _to_async_url(url: str) -> str:
    """Ensure the URL uses the asyncpg driver prefix."""
    if url.startswith("postgresql+asyncpg://"):
        return url
    if url.startswith("postgresql+psycopg://"):
        return url.replace("postgresql+psycopg://", _ASYNC_PREFIX, 1)
    # plain postgresql:// (e.g. Railway default)
    return url.replace("postgresql://", _ASYNC_PREFIX, 1)


def _to_sync_url(url: str) -> str:
    """Derive the psycopg (sync) URL from any postgresql:// variant."""
    if url.startswith("postgresql+psycopg://"):
        return url
    if url.startswith("postgresql+asyncpg://"):
        return url.replace("postgresql+asyncpg://", _SYNC_PREFIX, 1)
    # plain postgresql://
    return url.replace("postgresql://", _SYNC_PREFIX, 1)


class Settings(BaseSettings):
    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        case_sensitive=False,
        extra="ignore",
    )

    # Application
    APP_NAME: str = "ERP Backend"
    APP_ENV: str = "production"
    APP_DEBUG: bool = False
    API_V1_PREFIX: str = "/api/v1"

    # Database - Individual components (used by Docker Compose / entrypoint.sh)
    POSTGRES_USER: str = "erp_user"
    POSTGRES_PASSWORD: str = "erp_password"
    POSTGRES_DB: str = "erp_db"
    POSTGRES_HOST: str = "db"
    POSTGRES_PORT: int = 5432

    # Only this needs to be set in .env / Railway variables.
    # Accepts plain postgresql://, postgresql+asyncpg://, or postgresql+psycopg://
    DATABASE_URL: str = "postgresql+asyncpg://erp_user:erp_password@db:5432/erp_db"

    # Server
    HOST: str = "0.0.0.0"
    PORT: int = 8000

    # CORS - Frontend origins
    CORS_ORIGINS: str = "http://localhost:3000"

    def model_post_init(self, __context) -> None:
        """Normalise URLs and pick up Railway's dynamic PORT after field init."""
        # Normalise DATABASE_URL to always use +asyncpg
        object.__setattr__(self, "DATABASE_URL", _to_async_url(self.DATABASE_URL))

        # Handle Railway's dynamic PORT assignment
        railway_port = os.getenv("PORT")
        if railway_port:
            try:
                object.__setattr__(self, "PORT", int(railway_port))
            except (ValueError, TypeError):
                pass

    @property
    def DATABASE_URL_SYNC(self) -> str:
        """Sync URL for Alembic — always derived from DATABASE_URL."""
        return _to_sync_url(self.DATABASE_URL)

    @property
    def cors_origins_list(self) -> list[str]:
        """Parse CORS_ORIGINS as a comma-separated list."""
        return [o.strip() for o in self.CORS_ORIGINS.split(",") if o.strip()]

    @property
    def is_railway(self) -> bool:
        """True when running on Railway."""
        return (
            "railway" in self.DATABASE_URL.lower()
            or os.getenv("RAILWAY_ENVIRONMENT") is not None
            or os.getenv("RAILWAY_PROJECT_ID") is not None
        )


@lru_cache
def get_settings() -> Settings:
    """Return a cached Settings instance (avoids re-parsing env on every call)."""
    return Settings()


settings = get_settings()
