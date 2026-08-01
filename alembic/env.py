"""
Alembic environment configuration.

Uses the synchronous database URL (`DATABASE_URL_SYNC`) from application
settings and targets `Base.metadata` so that `alembic revision
--autogenerate` detects changes to every model that inherits from
BaseEntity (which itself inherits from Base).

All application models must be imported here (or re-exported through
`app/models/__init__.py`) before `target_metadata` is set, otherwise
Alembic will not see them during autogenerate.
"""
from logging.config import fileConfig

from alembic import context
from sqlalchemy import engine_from_config, pool

from app.core.config import settings
from app.db.base import Base

# Import all models so their tables are registered on Base.metadata before
# autogenerate runs.  Add new model imports here as they are created.
# e.g.: from app.models import customer, job  # noqa: F401
import app.models  # noqa: F401  — re-exports every model in the package

# ---------------------------------------------------------------------------
# Alembic config
# ---------------------------------------------------------------------------
config = context.config

if config.config_file_name is not None:
    fileConfig(config.config_file_name)

# Get the sync database URL from settings
# This ensures we never use an empty string
database_url_sync = settings.DATABASE_URL_SYNC

# Validation: ensure we have a valid database URL
if not database_url_sync or database_url_sync.strip() == "":
    raise ValueError(
        "DATABASE_URL_SYNC is empty or not set. "
        "Alembic cannot proceed without a valid database connection string. "
        "Check that DATABASE_URL or POSTGRES_* environment variables are properly configured."
    )

# Print diagnostic information
print(f"[ALEMBIC] Using DATABASE_URL_SYNC from settings")
print(f"[ALEMBIC] sqlalchemy.url has been set (password masked)")

# Set the SQLAlchemy URL for Alembic
config.set_main_option("sqlalchemy.url", database_url_sync)

target_metadata = Base.metadata


# ---------------------------------------------------------------------------
# Migration runners
# ---------------------------------------------------------------------------

def run_migrations_offline() -> None:
    """Run migrations in 'offline' mode (no live DB connection required)."""
    url = config.get_main_option("sqlalchemy.url")
    
    # Additional validation
    if not url or url.strip() == "":
        raise ValueError(
            "sqlalchemy.url is empty in offline mode. "
            "This should never happen if DATABASE_URL_SYNC is properly set."
        )
    
    context.configure(
        url=url,
        target_metadata=target_metadata,
        literal_binds=True,
        dialect_opts={"paramstyle": "named"},
        compare_type=True,
        compare_server_default=True,
    )
    with context.begin_transaction():
        context.run_migrations()


def run_migrations_online() -> None:
    """Run migrations in 'online' mode (with an active DB connection)."""
    # Get configuration section
    configuration = config.get_section(config.config_ini_section, {})
    
    # Ensure sqlalchemy.url is set
    if "sqlalchemy.url" not in configuration or not configuration["sqlalchemy.url"]:
        raise ValueError(
            "sqlalchemy.url is missing from Alembic configuration. "
            "This should never happen if DATABASE_URL_SYNC is properly set."
        )
    
    connectable = engine_from_config(
        configuration,
        prefix="sqlalchemy.",
        poolclass=pool.NullPool,
    )
    
    with connectable.connect() as connection:
        context.configure(
            connection=connection,
            target_metadata=target_metadata,
            compare_type=True,
            compare_server_default=True,
        )
        with context.begin_transaction():
            context.run_migrations()


if context.is_offline_mode():
    run_migrations_offline()
else:
    run_migrations_online()
