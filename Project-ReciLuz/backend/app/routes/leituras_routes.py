"""
Routes for readings management.
"""

from typing import List
from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
from app.database import get_db
from app.services.leituras_service import LeituraService
from app.schemas import LeituraCreate, LeituraResponse, MensagemResposta

router = APIRouter(prefix="/leituras", tags=["leituras"])


@router.post("", response_model=MensagemResposta)
def salvar_leitura(leitura: LeituraCreate, db: Session = Depends(get_db)):
    """
    Save a reading from Node-RED.

    Args:
        leitura: Reading data

    Returns:
        Success message
    """
    LeituraService.salvar_leitura(db, leitura)
    return {"mensagem": "Leitura salva com sucesso"}


@router.get("", response_model=List[LeituraResponse])
def obter_leituras(limite: int = 100, db: Session = Depends(get_db)):
    """
    Get all readings ordered by most recent first.

    Args:
        limite: Maximum number of records to return (default: 100)

    Returns:
        List of readings
    """
    return LeituraService.obter_leituras(db, limite)


@router.get("/ultimas", response_model=LeituraResponse)
def obter_ultima_leitura(db: Session = Depends(get_db)):
    """
    Get the latest reading for lamp ID 1.

    Returns:
        Latest reading
    """
    return LeituraService.obter_ultima_leitura(db, lampada_id=1)
