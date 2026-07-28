"""
Application configuration.

Settings are loaded from environment variables (and a local .env file
during development) using pydantic-settings. Import `settings` anywhere
in the application to access configuration values.
"""
import os
from functools import lru_cache

from pydantic_settings import BaseSettings, SettingsConfigDict


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

    # Database - Individual components (used by Docker Compose and entrypoint.sh)
    POSTGRES_USER: str = "erp_user"
    POSTGRES_PASSWORD: str = "erp_password"
    POSTGRES_DB: str = "erp_db"
    POSTGRES_HOST: str = "db"
    POSTGRES_PORT: int = 5432

    # Database URLs - will be auto-transformed if Railway DATABASE_URL is detected
    DATABASE_URL: str = (
        "postgresql+asyncpg://erp_user:erp_password@db:5432/erp_db"
    )
    DATABASE_URL_SYNC: str = (
        "postgresql+psycopg://erp_user:erp_password@db:5432/erp_db"
    )

    # Server
    HOST: str = "0.0.0.0"
    PORT: int = 8000

    # CORS - Frontend origins
    CORS_ORIGINS: str = "http://localhost:3000"

    def __init__(self, **kwargs):
        super().__init__(**kwargs)
        
        # Auto-transform Railway DATABASE_URL if provided
        # Railway provides: postgresql://user:pass@host:port/db
        # We need: postgresql+asyncpg://... and postgresql+psycopg://...
        railway_db_url = os.getenv("DATABASE_URL")
        
        # Only transform if it's a plain postgresql:// URL (Railway format)
        # Skip if already has +asyncpg or +psycopg (user explicitly set it)
        if railway_db_url and railway_db_url.startswith("postgresql://"):
            # Check if user explicitly set DATABASE_URL with driver
            explicit_db_url = os.getenv("DATABASE_URL")
            if explicit_db_url and ("+asyncpg" not in explicit_db_url and "+psycopg" not in explicit_db_url):
                # Transform Railway URL to async driver format
                self.DATABASE_URL = railway_db_url.replace(
                    "postgresql://", "postgresql+asyncpg://", 1
                )
                # Transform Railway URL to sync driver format
                self.DATABASE_URL_SYNC = railway_db_url.replace(
                    "postgresql://", "postgresql+psycopg://", 1
                )
        
        # Handle Railway's dynamic PORT assignment
        railway_port = os.getenv("PORT")
        if railway_port:
            try:
                self.PORT = int(railway_port)
            except (ValueError, TypeError):
                pass  # Keep default if PORT is invalid
        
        # DIAGNOSTIC: Print final configuration
        self._print_final_config()

    @property
    def cors_origins_list(self) -> list[str]:
        """Parse CORS_ORIGINS as comma-separated list."""
        return [origin.strip() for origin in self.CORS_ORIGINS.split(",") if origin.strip()]
    
    @property
    def is_railway(self) -> bool:
        """Detect if running on Railway by checking for Railway-specific indicators."""
        return (
            "railway" in self.DATABASE_URL.lower() or
            os.getenv("RAILWAY_ENVIRONMENT") is not None or
            os.getenv("RAILWAY_PROJECT_ID") is not None
        )
    
    def _print_final_config(self):
        """Print final database configuration for diagnostics."""
        try:
            from sqlalchemy.engine import make_url
            
            print("=" * 60)
            print("FINAL DATABASE CONFIG")
            print("=" * 60)
            
            # Parse DATABASE_URL
            try:
                url_async = make_url(self.DATABASE_URL)
                print("\nDATABASE_URL (Async - FastAPI):")
                print(f"  Driver:   {url_async.drivername}")
                print(f"  Host:     {url_async.host}")
                print(f"  Port:     {url_async.port}")
                print(f"  Database: {url_async.database}")
                print(f"  Username: {url_async.username}")
            except Exception as e:
                print(f"\nDATABASE_URL: ERROR parsing: {e}")
                print(f"  Raw value: {self._mask_password(self.DATABASE_URL)}")
            
            # Parse DATABASE_URL_SYNC
            try:
                url_sync = make_url(self.DATABASE_URL_SYNC)
                print("\nDATABASE_URL_SYNC (Sync - Alembic):")
                print(f"  Driver:   {url_sync.drivername}")
                print(f"  Host:     {url_sync.host}")
                print(f"  Port:     {url_sync.port}")
                print(f"  Database: {url_sync.database}")
                print(f"  Username: {url_sync.username}")
            except Exception as e:
                print(f"\nDATABASE_URL_SYNC: ERROR parsing: {e}")
                print(f"  Raw value: {self._mask_password(self.DATABASE_URL_SYNC)}")
            
            print("\n" + "=" * 60)
            
        except ImportError:
            # Fallback if sqlalchemy not available yet
            print("=" * 60)
            print("FINAL DATABASE CONFIG (SQLAlchemy not loaded)")
            print("=" * 60)
            print(f"\nDATABASE_URL:      {self._mask_password(self.DATABASE_URL)}")
            print(f"DATABASE_URL_SYNC: {self._mask_password(self.DATABASE_URL_SYNC)}")
            print("=" * 60)
    
    @staticmethod
    def _mask_password(url: str) -> str:
        """Mask password in URL for safe printing."""
        if not url or '@' not in url:
            return url
        try:
            parts = url.split('@')
            if '://' in parts[0]:
                protocol, auth = parts[0].split('://', 1)
                if ':' in auth:
                    user, _ = auth.rsplit(':', 1)
                    return f"{protocol}://{user}:****@{parts[1]}"
            return url
        except Exception:
            return url


@lru_cache
def get_settings() -> Settings:
    """Return a cached Settings instance (avoids re-parsing env on every call)."""
    return Settings()


settings = get_settings()
