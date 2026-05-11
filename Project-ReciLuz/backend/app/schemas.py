"""
Pydantic schemas for request/response validation.
"""

from datetime import datetime
from typing import Optional
from pydantic import BaseModel, Field


class LampadaBase(BaseModel):
    """
    Base schema for Lampada.
    """
    nome: str
    status: str


class LampadaCreate(LampadaBase):
    """
    Schema for creating a Lampada.
    """
    pass


class LampadaResponse(LampadaBase):
    """
    Schema for Lampada response.
    """
    id: int
    criada_em: datetime
    atualizada_em: datetime

    class Config:
        from_attributes = True


class LeituraBase(BaseModel):
    """
    Base schema for Leitura.
    """
    lampada_id: int
    status_lampada: str
    intensidade_pwm: Optional[int] = None
    corrente: Optional[float] = None
    potencia: Optional[float] = None
    consumo_estimado: Optional[float] = None
    presenca_detectada: Optional[bool] = None
    temperatura: Optional[float] = None
    umidade: Optional[float] = None
    qualidade_ar: Optional[float] = None


class LeituraCreate(LeituraBase):
    """
    Schema for creating a Leitura (from Node-RED).
    """
    pass


class LeituraResponse(LeituraBase):
    """
    Schema for Leitura response.
    """
    id: int
    criada_em: datetime

    class Config:
        from_attributes = True


class ComandoLampada(BaseModel):
    """
    Schema for lamp on/off commands.
    """
    lampada_id: int
    ligada: bool


class MensagemResposta(BaseModel):
    """
    Schema for generic messages.
    """
    mensagem: str


class ErrorResponse(BaseModel):
    """
    Schema for error responses.
    """
    erro: str
    detalhes: Optional[str] = None
