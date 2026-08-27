"""SQLAlchemy engine/session setup."""
from sqlalchemy import create_engine
from sqlalchemy.orm import DeclarativeBase, sessionmaker

from .config import get_settings

settings = get_settings()

# check_same_thread only matters for sqlite (used in local smoke-testing).
# client_encoding pins the psycopg2 connection to UTF-8 explicitly instead
# of relying on the host process's locale — some hosts (Render's included)
# don't default to a UTF-8 locale, which otherwise silently mangles
# non-ASCII characters (e.g. "…" round-tripping as "â€¦") on write/read.
if settings.database_url.startswith("sqlite"):
    connect_args = {"check_same_thread": False}
else:
    connect_args = {"client_encoding": "utf8"}

engine = create_engine(settings.normalized_database_url, connect_args=connect_args, pool_pre_ping=True)
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)


class Base(DeclarativeBase):
    pass


def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()
