"""SQLAlchemy engine and session factory."""

import os
from functools import lru_cache

from dotenv import load_dotenv
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker

load_dotenv()


@lru_cache(maxsize=1)
def _get_engine():
    url = os.environ.get("DATABASE_URL", "postgresql://postgres:postgres@localhost:5432/afg_market")
    return create_engine(url, pool_pre_ping=True, pool_size=5, max_overflow=10)


def _get_session_factory():
    return sessionmaker(bind=_get_engine(), autocommit=False, autoflush=False)


def get_db():
    db = _get_session_factory()()
    try:
        yield db
    finally:
        db.close()
