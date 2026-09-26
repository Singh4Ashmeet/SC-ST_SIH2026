"""
Database session management using SQLAlchemy 2.0 async-compatible style.
"""

from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker, DeclarativeBase

from app.core.config import get_settings

settings = get_settings()

import sqlite3
import uuid
from datetime import datetime, timezone
from sqlalchemy import event
from sqlalchemy.dialects.postgresql import JSONB, UUID as PG_UUID
from sqlalchemy.ext.compiler import compiles

@compiles(JSONB, "sqlite")
def _compile_jsonb_sqlite(type_, compiler, **kw):
    return "JSON"

@compiles(PG_UUID, "sqlite")
def _compile_uuid_sqlite(type_, compiler, **kw):
    return "TEXT"

engine_kwargs = {
    "pool_pre_ping": True,
    "echo": settings.DEBUG,
}

if not settings.DATABASE_URL.startswith("sqlite"):
    engine_kwargs.update({
        "pool_size": 20,
        "max_overflow": 30,
        "pool_recycle": 300,
        "pool_use_lifo": True,
    })

engine = create_engine(
    settings.DATABASE_URL,
    **engine_kwargs
)

@event.listens_for(engine, "connect")
def _sqlite_connect(dbapi_connection, connection_record):
    if isinstance(dbapi_connection, sqlite3.Connection):
        dbapi_connection.create_function("now", 0, lambda: datetime.now(timezone.utc).isoformat())
        dbapi_connection.create_function("gen_random_uuid", 0, lambda: str(uuid.uuid4()))

SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)


from app.models.base import Base


def get_db():
    """Dependency that yields a database session."""
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()
