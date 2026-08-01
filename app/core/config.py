"""
Application configuration.

Settings are loaded from environment variables (and a local .env file
during development) using pydantic-settings. Import `settings` anywhere
in the application to access configuration values.

DATABASE_URL can be set explicitly (e.g., Railway injects it automatically),
or it will be auto-constructed from POSTGRES_* variables (e.g., Docker Compose).

DATABASE_URL accepts any of these forms:
  - postgresql://...          (plain, e.g. from Railway's default injection)
  - postgresql+asyncpg://...  (explicit async driver)
  - postgresql+psycopg://...  (sync driver)

DATABASE_URL_SYNC is always derived automatically by swapping the driver
prefix to +psycopg, so it never needs to appear in .env or Railway vars.
"""
import os
import re
from functools import lru_cache

from pydantic_settings import BaseSettings, SettingsConfigDict

# Async driver prefix used by SQLAlchemy's create_async_engine
_ASYNC_PREFIX = "postgresql+asyncpg://"
# Sync driver prefix used by Alembic
_SYNC_PREFIX = "postgresql+psycopg://"


def _mask_password(url: str) -> str:
    """Mask password in database URL for safe logging."""
    if not url:
        return url
    # Match pattern: protocol://user:password@host...
    return re.sub(r'(:\/\/[^:]+:)[^@]+(@)', r'\1****\2', url)


def _to_async_url(url: str) -> str:
    """Ensure the URL uses the asyncpg driver prefix."""
    if not url:
        return url
    if url.startswith("postgresql+asyncpg://"):
        return url
    if url.startswith("postgresql+psycopg://"):
        return url.replace("postgresql+psycopg://", _ASYNC_PREFIX, 1)
    # plain postgresql:// (e.g. Railway default)
    return url.replace("postgresql://", _ASYNC_PREFIX, 1)


def _to_sync_url(url: str) -> str:
    """Derive the psycopg (sync) URL from any postgresql:// variant."""
    if not url:
        return url
    if url.startswith("postgresql+psycopg://"):
        return url
    if url.startswith("postgresql+asyncpg://"):
        return url.replace("postgresql+asyncpg://", _SYNC_PREFIX, 1)
    # plain postgresql://
    return url.replace("postgresql://", _SYNC_PREFIX, 1)


def _extract_host_from_url(url: str) -> str:
    """Extract hostname from database URL."""
    if not url:
        return "unknown"
    match = re.search(r'@([^:/]+)', url)
    return match.group(1) if match else "unknown"


def _extract_driver_from_url(url: str) -> str:
    """Extract driver from database URL."""
    if not url:
        return "unknown"
    if "postgresql+asyncpg://" in url:
        return "asyncpg"
    elif "postgresql+psycopg://" in url:
        return "psycopg"
    elif url.startswith("postgresql://"):
        return "default (psycopg2)"
    return "unknown"


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

    # Database - Individual components (used by Docker Compose)
    POSTGRES_USER: str = "erp_user"
    POSTGRES_PASSWORD: str = "erp_password"
    POSTGRES_DB: str = "erp_db"
    POSTGRES_HOST: str = "db"
    POSTGRES_PORT: int = 5432

    # DATABASE_URL is optional - if not provided, will be constructed from POSTGRES_* vars
    # Railway injects this automatically; Docker Compose constructs it from individual vars
    DATABASE_URL: str | None = None

    # Server
    HOST: str = "0.0.0.0"
    PORT: int = 8000

    # CORS - Frontend origins
    CORS_ORIGINS: str = "http://localhost:3000"

    def model_post_init(self, __context) -> None:
        """Construct DATABASE_URL if missing, normalize URLs, and handle Railway PORT."""
        # If DATABASE_URL is not set or is empty, construct it from POSTGRES_* variables
        if not self.DATABASE_URL or self.DATABASE_URL.strip() == "":
            constructed_url = (
                f"postgresql+asyncpg://"
                f"{self.POSTGRES_USER}:"
                f"{self.POSTGRES_PASSWORD}@"
                f"{self.POSTGRES_HOST}:"
                f"{self.POSTGRES_PORT}/"
                f"{self.POSTGRES_DB}"
            )
            object.__setattr__(self, "DATABASE_URL", constructed_url)
            print(f"[CONFIG] DATABASE_URL not provided - constructed from POSTGRES_* variables")
        else:
            # DATABASE_URL was provided (e.g., Railway) - normalize it to use asyncpg
            normalized_url = _to_async_url(self.DATABASE_URL)
            object.__setattr__(self, "DATABASE_URL", normalized_url)
            print(f"[CONFIG] DATABASE_URL provided - normalized to asyncpg driver")

        # Print diagnostic information (with masked password)
        print(f"[CONFIG] DATABASE_URL: {_mask_password(self.DATABASE_URL)}")
        print(f"[CONFIG] DATABASE_URL host: {_extract_host_from_url(self.DATABASE_URL)}")
        print(f"[CONFIG] DATABASE_URL driver: {_extract_driver_from_url(self.DATABASE_URL)}")
        
        # Derive sync URL
        sync_url = _to_sync_url(self.DATABASE_URL)
        print(f"[CONFIG] DATABASE_URL_SYNC: {_mask_password(sync_url)}")
        print(f"[CONFIG] DATABASE_URL_SYNC host: {_extract_host_from_url(sync_url)}")
        print(f"[CONFIG] DATABASE_URL_SYNC driver: {_extract_driver_from_url(sync_url)}")

        # Handle Railway's dynamic PORT assignment
        railway_port = os.getenv("PORT")
        if railway_port:
            try:
                object.__setattr__(self, "PORT", int(railway_port))
                print(f"[CONFIG] Using Railway PORT: {railway_port}")
            except (ValueError, TypeError):
                pass

    @property
    def DATABASE_URL_SYNC(self) -> str:
        """Sync URL for Alembic — always derived from DATABASE_URL."""
        if not self.DATABASE_URL:
            raise ValueError(
                "DATABASE_URL is not set. Cannot derive DATABASE_URL_SYNC. "
                "Ensure POSTGRES_* variables are properly configured."
            )
        return _to_sync_url(self.DATABASE_URL)

    @property
    def cors_origins_list(self) -> list[str]:
        """Parse CORS_ORIGINS as a comma-separated list."""
        return [o.strip() for o in self.CORS_ORIGINS.split(",") if o.strip()]

    @property
    def is_railway(self) -> bool:
        """True when running on Railway."""
        return (
            (self.DATABASE_URL and "railway" in self.DATABASE_URL.lower())
            or os.getenv("RAILWAY_ENVIRONMENT") is not None
            or os.getenv("RAILWAY_PROJECT_ID") is not None
        )


@lru_cache
def get_settings() -> Settings:
    """Return a cached Settings instance (avoids re-parsing env on every call)."""
    return Settings()


settings = get_settings()
