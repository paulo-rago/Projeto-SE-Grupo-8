"""
Service for readings management.
"""

from sqlalchemy.orm import Session
from fastapi import HTTPException
from app.models import Leitura, Lampada
from app.schemas import LeituraCreate


class LeituraService:
    """
    Service for readings-related operations.
    """

    POTENCIA_MAXIMA_W = 10.2
    INTERVALO_LEITURA_HORAS = 5 / 3600

    @staticmethod
    def salvar_leitura(db: Session, leitura_data: LeituraCreate) -> Leitura:
        """
        Save a reading to the database.

        Args:
            db: Database session
            leitura_data: Reading data

        Returns:
            Created Leitura object

        Raises:
            HTTPException if lamp not found
        """
        # Verify lamp exists
        lampada = db.query(Lampada).filter(Lampada.id == leitura_data.lampada_id).first()
        if not lampada:
            raise HTTPException(status_code=404, detail="Lâmpada não encontrada")

        potencia = leitura_data.potencia
        consumo_estimado = leitura_data.consumo_estimado

        if potencia is None and leitura_data.intensidade_pwm is not None:
            fator_pwm = max(0, min(leitura_data.intensidade_pwm, 255)) / 255
            potencia = round(fator_pwm * LeituraService.POTENCIA_MAXIMA_W, 2)

        if consumo_estimado is None and potencia is not None:
            consumo_estimado = round((potencia / 1000) * LeituraService.INTERVALO_LEITURA_HORAS, 8)

        # Create reading
        leitura = Leitura(
            lampada_id=leitura_data.lampada_id,
            status_lampada=leitura_data.status_lampada,
            intensidade_pwm=leitura_data.intensidade_pwm,
            distancia_cm=leitura_data.distancia_cm,
            modo=leitura_data.modo,
            modo_remoto=leitura_data.modo_remoto,
            corrente=leitura_data.corrente,
            potencia=potencia,
            consumo_estimado=consumo_estimado,
            presenca_detectada=leitura_data.presenca_detectada,
            som_detectado=leitura_data.som_detectado,
            nivel_ruido_db=leitura_data.nivel_ruido_db,
            temperatura=leitura_data.temperatura,
            umidade=leitura_data.umidade,
            qualidade_ar=leitura_data.qualidade_ar
        )

        db.add(leitura)
        db.commit()
        db.refresh(leitura)

        return leitura

    @staticmethod
    def obter_leituras(db: Session, limite: int = 100) -> list:
        """
        Get all readings ordered by most recent first.

        Args:
            db: Database session
            limite: Number of records to return

        Returns:
            List of Leitura objects
        """
        leituras = db.query(Leitura).order_by(Leitura.criada_em.desc()).limit(limite).all()
        return leituras

    @staticmethod
    def obter_ultima_leitura(db: Session, lampada_id: int = 1) -> Leitura:
        """
        Get the latest reading for a lamp.

        Args:
            db: Database session
            lampada_id: Lamp ID

        Returns:
            Latest Leitura object

        Raises:
            HTTPException if no readings found
        """
        leitura = (
            db.query(Leitura)
            .filter(Leitura.lampada_id == lampada_id)
            .order_by(Leitura.criada_em.desc())
            .first()
        )

        if not leitura:
            raise HTTPException(status_code=404, detail="Nenhuma leitura encontrada")

        return leitura
