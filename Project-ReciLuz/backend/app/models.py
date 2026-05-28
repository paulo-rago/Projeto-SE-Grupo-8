"""
SQLAlchemy models for the database.
"""

from datetime import datetime
from zoneinfo import ZoneInfo
from sqlalchemy import Column, Integer, String, Float, Boolean, DateTime, ForeignKey
from sqlalchemy.orm import relationship
from app.base import Base

RECIFE_TZ = ZoneInfo("America/Recife")


def agora_recife():
    """
    Return local Recife time as a naive datetime for SQLite storage.
    """
    return datetime.now(RECIFE_TZ).replace(tzinfo=None)


class Lampada(Base):
    """
    Model for the lamp table.
    """
    __tablename__ = "lampadas"

    id = Column(Integer, primary_key=True, index=True)
    nome = Column(String, nullable=False)
    status = Column(String, default="desligada", nullable=False)
    criada_em = Column(DateTime, default=agora_recife, nullable=False)
    atualizada_em = Column(DateTime, default=agora_recife, onupdate=agora_recife, nullable=False)

    # Relationship
    leituras = relationship("Leitura", back_populates="lampada")

    def __repr__(self):
        return f"<Lampada(id={self.id}, nome={self.nome}, status={self.status})>"


class Leitura(Base):
    """
    Model for the readings table.
    """
    __tablename__ = "leituras"

    id = Column(Integer, primary_key=True, index=True)
    lampada_id = Column(Integer, ForeignKey("lampadas.id"), nullable=False)
    status_lampada = Column(String, nullable=False)
    intensidade_pwm = Column(Integer, nullable=True)
    distancia_cm = Column(Float, nullable=True)
    modo = Column(String, nullable=True)
    modo_remoto = Column(Boolean, nullable=True)
    corrente = Column(Float, nullable=True)
    potencia = Column(Float, nullable=True)
    consumo_estimado = Column(Float, nullable=True)
    presenca_detectada = Column(Boolean, nullable=True)
    som_detectado = Column(Boolean, nullable=True)
    nivel_ruido_db = Column(Float, nullable=True)
    temperatura = Column(Float, nullable=True)
    umidade = Column(Float, nullable=True)
    qualidade_ar = Column(Float, nullable=True)
    criada_em = Column(DateTime, default=agora_recife, nullable=False)

    # Relationship
    lampada = relationship("Lampada", back_populates="leituras")

    def __repr__(self):
        return f"<Leitura(id={self.id}, lampada_id={self.lampada_id}, status_lampada={self.status_lampada})>"
