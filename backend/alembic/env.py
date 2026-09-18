"""
Alembic environment configuration.

Reads the DATABASE_URL from app.core.config so we have a single source of
truth for database connection strings.
"""

from logging.config import fileConfig

from sqlalchemy import engine_from_config, pool

from alembic import context

# -- Alembic Config object ---------------------------------------------------
config = context.config

# Interpret the config file for Python logging.
if config.config_file_name is not None:
    fileConfig(config.config_file_name)

# -- Import the DeclarativeBase metadata for autogenerate support -------------
import app.models  # noqa: F401
from app.models.base import Base  # noqa: E402

target_metadata = Base.metadata

# -- Override sqlalchemy.url from our Settings --------------------------------
from app.core.config import get_settings    # noqa: E402
config.set_main_option("sqlalchemy.url", get_settings().DATABASE_URL)


def run_migrations_offline() -> None:
    """Run migrations in 'offline' mode."""
    url = config.get_main_option("sqlalchemy.url")
    context.configure(
        url=url,
        target_metadata=target_metadata,
        literal_binds=True,
        dialect_opts={"paramstyle": "named"},
    )
    with context.begin_transaction():
        context.run_migrations()


def run_migrations_online() -> None:
    """Run migrations in 'online' mode."""
    connectable = engine_from_config(
        config.get_section(config.config_ini_section, {}),
        prefix="sqlalchemy.",
        poolclass=pool.NullPool,
    )
    with connectable.connect() as connection:
        context.configure(
            connection=connection,
            target_metadata=target_metadata,
        )
        with context.begin_transaction():
            context.run_migrations()


if context.is_offline_mode():
    run_migrations_offline()
else:
    run_migrations_online()
