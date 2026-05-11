"""
Routes for lamp control.
"""

from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
from app.database import get_db
from app.services.lampada_service import LampadaService
from app.schemas import MensagemResposta, LampadaResponse

router = APIRouter(prefix="/lampada", tags=["lampada"])


@router.get("/status", response_model=LampadaResponse)
def obter_status_lampada(db: Session = Depends(get_db)):
    """
    Get the current status of lamp ID 1.

    Returns:
        Current lamp status
    """
    return LampadaService.obter_status_lampada(db, lampada_id=1)


@router.post("/ligar", response_model=MensagemResposta)
def ligar_lampada(db: Session = Depends(get_db)):
    """
    Turn on lamp ID 1.

    Returns:
        Success message
    """
    return LampadaService.ligar_lampada(db, lampada_id=1)


@router.post("/desligar", response_model=MensagemResposta)
def desligar_lampada(db: Session = Depends(get_db)):
    """
    Turn off lamp ID 1.

    Returns:
        Success message
    """
    return LampadaService.desligar_lampada(db, lampada_id=1)
