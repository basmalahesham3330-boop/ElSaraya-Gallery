"""
Application configuration.

Settings are loaded from environment variables (and a local .env file
during development) using pydantic-settings. Import `settings` anywhere
in the application to access configuration values.
"""
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

    # Database
    POSTGRES_USER: str = "erp_user"
    POSTGRES_PASSWORD: str = "erp_password"
    POSTGRES_DB: str = "erp_db"
    POSTGRES_HOST: str = "db"
    POSTGRES_PORT: int = 5432

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

    @property
    def cors_origins_list(self) -> list[str]:
        """Parse CORS_ORIGINS as comma-separated list."""
        return [origin.strip() for origin in self.CORS_ORIGINS.split(",") if origin.strip()]


@lru_cache
def get_settings() -> Settings:
    """Return a cached Settings instance (avoids re-parsing env on every call)."""
    return Settings()


settings = get_settings()
