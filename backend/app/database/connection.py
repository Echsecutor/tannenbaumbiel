"""
Database connection and session management
"""
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker, Session as SqlSession
from sqlalchemy.pool import StaticPool

from app.config.settings import settings
from app.database.models import Base


# Database engine
engine = None
SessionLocal = None


def init_database():
    """Initialize database connection"""
    global engine, SessionLocal

    # Create engine
    engine = create_engine(
        settings.database_url,
        echo=settings.debug,  # Log SQL queries in debug mode
        pool_pre_ping=True,  # Validate connections before use
        pool_recycle=300,    # Recycle connections every 5 minutes
    )

    # Create session factory
    SessionLocal = sessionmaker(
        autocommit=False,
        autoflush=False,
        bind=engine
    )

    # Create tables if they don't exist (for development)
    # In production, use Alembic migrations
    Base.metadata.create_all(bind=engine)


def get_db() -> SqlSession:
    """
    Dependency function to get database session
    Use this in FastAPI endpoints
    """
    if SessionLocal is None:
        raise RuntimeError("Database not initialized. Call init_database() first.")

    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


def get_db_session() -> SqlSession:
    """
    Get database session for use outside FastAPI endpoints
    Remember to close the session when done!
    """
    if SessionLocal is None:
        raise RuntimeError("Database not initialized. Call init_database() first.")

    return SessionLocal()


def close_database():
    """Close database connections"""
    global engine
    if engine:
        engine.dispose()
