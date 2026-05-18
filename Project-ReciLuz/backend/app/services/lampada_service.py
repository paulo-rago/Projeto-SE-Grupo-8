"""
Service for lamp management.
"""

from sqlalchemy.orm import Session
from fastapi import HTTPException
from app.models import Lampada
from app.services.nodered_service import NodeRedService


class LampadaService:
    """
    Service for lamp-related operations.
    """

    @staticmethod
    def obter_lampada(db: Session, lampada_id: int) -> Lampada:
        """
        Get lamp by ID.

        Args:
            db: Database session
            lampada_id: Lamp ID

        Returns:
            Lampada object

        Raises:
            HTTPException if lamp not found
        """
        lampada = db.query(Lampada).filter(Lampada.id == lampada_id).first()
        if not lampada:
            raise HTTPException(status_code=404, detail="Lâmpada não encontrada")
        return lampada

    @staticmethod
    def obter_status_lampada(db: Session, lampada_id: int):
        """
        Get lamp status.

        Args:
            db: Database session
            lampada_id: Lamp ID

        Returns:
            Lamp status information
        """
        lampada = LampadaService.obter_lampada(db, lampada_id)
        return lampada

    @staticmethod
    def ligar_lampada(db: Session, lampada_id: int):
        """
        Turn on the lamp.

        Args:
            db: Database session
            lampada_id: Lamp ID

        Returns:
            Message dict

        Raises:
            HTTPException if operation fails
        """
        lampada = LampadaService.obter_lampada(db, lampada_id)

        # Send command to Node-RED
        sucesso_nodered = NodeRedService.enviar_comando_lampada(lampada_id, True)

        if not sucesso_nodered:
            raise HTTPException(
                status_code=503,
                detail="Falha ao enviar comando para Node-RED. Verifique se o Node-RED está online."
            )

        # Update lamp status
        lampada.status = "ligada"
        db.commit()
        db.refresh(lampada)

        return {"mensagem": "Lâmpada ligada com sucesso"}

    @staticmethod
    def desligar_lampada(db: Session, lampada_id: int):
        """
        Turn off the lamp.

        Args:
            db: Database session
            lampada_id: Lamp ID

        Returns:
            Message dict

        Raises:
            HTTPException if operation fails
        """
        lampada = LampadaService.obter_lampada(db, lampada_id)

        # Send command to Node-RED
        sucesso_nodered = NodeRedService.enviar_comando_lampada(lampada_id, False)

        if not sucesso_nodered:
            raise HTTPException(
                status_code=503,
                detail="Falha ao enviar comando para Node-RED. Verifique se o Node-RED está online."
            )

        # Update lamp status
        lampada.status = "desligada"
        db.commit()
        db.refresh(lampada)

        return {"mensagem": "Lâmpada desligada com sucesso"}

    @staticmethod
    def ativar_modo_automatico(db: Session, lampada_id: int):
        """
        Return lamp control to the ESP32 proximity sensor.
        """
        lampada = LampadaService.obter_lampada(db, lampada_id)

        sucesso_nodered = NodeRedService.enviar_comando_lampada(lampada_id, automatico=True)

        if not sucesso_nodered:
            raise HTTPException(
                status_code=503,
                detail="Falha ao enviar comando para Node-RED. Verifique se o Node-RED está online."
            )

        lampada.status = "automatico"
        db.commit()
        db.refresh(lampada)

        return {"mensagem": "Modo automático ativado com sucesso"}
