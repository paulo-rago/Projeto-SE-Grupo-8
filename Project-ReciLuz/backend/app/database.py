"""
Database configuration and initialization.
"""

import os
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from dotenv import load_dotenv
from app.base import Base

# Load environment variables
load_dotenv()

# Get database URL from environment
DATABASE_URL = os.getenv("DATABASE_URL", "sqlite:///./reciluz.db")

# Create engine
engine = create_engine(
    DATABASE_URL,
    connect_args={"check_same_thread": False} if "sqlite" in DATABASE_URL else {}
)

# Create session factory
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)


def get_db():
    """
    Dependency to get database session.
    """
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


def init_db():
    """
    Initialize database with tables and default data.
    """
    # Import models to create tables
    from app.models import Lampada, Leitura

    # Create all tables
    Base.metadata.create_all(bind=engine)

    # Create default lamp if it doesn't exist
    db = SessionLocal()
    try:
        lampada_existente = db.query(Lampada).filter(Lampada.id == 1).first()
        if not lampada_existente:
            lampada_padrao = Lampada(
                id=1,
                nome="Lâmpada Protótipo",
                status="desligada"
            )
            db.add(lampada_padrao)
            db.commit()
    finally:
        db.close()
