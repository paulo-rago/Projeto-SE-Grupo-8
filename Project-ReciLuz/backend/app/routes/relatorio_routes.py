"""
Routes for newsletter subscription and daily report dispatch.
"""

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from app.database import get_db
from app.models import Assinante
from app.schemas import AssinanteRequest, AssinanteResponse, MensagemResposta
from app.services.relatorio_service import enviar_relatorio_todos

router = APIRouter(prefix="/relatorio", tags=["relatorio"])


@router.post("/assinar", response_model=MensagemResposta)
def assinar(body: AssinanteRequest, db: Session = Depends(get_db)):
    assinante = db.query(Assinante).filter(Assinante.email == body.email).first()
    if assinante:
        if assinante.ativo:
            return {"mensagem": "E-mail já cadastrado."}
        assinante.ativo = True
        db.commit()
        return {"mensagem": "Inscrição reativada com sucesso."}
    db.add(Assinante(email=body.email))
    db.commit()
    return {"mensagem": "Inscrição realizada com sucesso."}


@router.post("/cancelar", response_model=MensagemResposta)
def cancelar(body: AssinanteRequest, db: Session = Depends(get_db)):
    assinante = db.query(Assinante).filter(Assinante.email == body.email).first()
    if not assinante or not assinante.ativo:
        raise HTTPException(status_code=404, detail="E-mail não encontrado na lista de assinantes.")
    assinante.ativo = False
    db.commit()
    return {"mensagem": "Inscrição cancelada com sucesso."}


@router.post("/enviar-agora", response_model=MensagemResposta)
def enviar_agora(db: Session = Depends(get_db)):
    enviados = enviar_relatorio_todos(db)
    return {"mensagem": f"Relatório enviado para {enviados} assinante(s)."}
