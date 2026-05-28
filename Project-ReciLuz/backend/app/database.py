"""
Database configuration and initialization.
"""

import os
from sqlalchemy import create_engine
from sqlalchemy import text
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


def _migrar_sqlite():
    """
    Add dashboard columns to an existing SQLite database.
    """
    if "sqlite" not in DATABASE_URL:
        return

    colunas_novas = {
        "distancia_cm": "FLOAT",
        "modo": "VARCHAR",
        "modo_remoto": "BOOLEAN",
        "som_detectado": "BOOLEAN",
        "nivel_ruido_db": "FLOAT",
    }

    with engine.begin() as connection:
        colunas_existentes = {
            row[1] for row in connection.execute(text("PRAGMA table_info(leituras)"))
        }
        for nome, tipo in colunas_novas.items():
            if nome not in colunas_existentes:
                connection.execute(text(f"ALTER TABLE leituras ADD COLUMN {nome} {tipo}"))


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
    _migrar_sqlite()

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
