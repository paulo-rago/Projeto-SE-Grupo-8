"""
Service for communication with Node-RED.
"""

import os
import requests
from dotenv import load_dotenv

load_dotenv()

NODE_RED_COMMAND_URL = os.getenv("NODE_RED_COMMAND_URL", "http://127.0.0.1:1880/comando-lampada")


class NodeRedService:
    """
    Service to communicate with Node-RED.
    """

    @staticmethod
    def enviar_comando_lampada(lampada_id: int, ligada: bool | None = None, automatico: bool = False) -> bool:
        """
        Send lamp command to Node-RED.

        Args:
            lampada_id: Lamp ID
            ligada: True for ON, False for OFF

        Returns:
            True if successful, False otherwise
        """
        try:
            payload = {"lampada_id": lampada_id}
            if automatico:
                payload["automatico"] = True
            else:
                payload["ligada"] = ligada

            response = requests.post(
                NODE_RED_COMMAND_URL,
                json=payload,
                timeout=5
            )

            return response.status_code == 200

        except requests.exceptions.ConnectionError:
            print(f"Erro: Não foi possível conectar ao Node-RED em {NODE_RED_COMMAND_URL}")
            return False
        except requests.exceptions.Timeout:
            print(f"Erro: Timeout ao enviar comando para Node-RED")
            return False
        except Exception as e:
            print(f"Erro ao enviar comando para Node-RED: {str(e)}")
            return False
