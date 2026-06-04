# ReciLuz — Backend

API REST em FastAPI para o sistema IoT de iluminação pública ReciLuz.

> Para instruções completas de execução, consulte o [README principal](../README.md).

---

## Estrutura

```
backend/
├── main.py                        # Entrada FastAPI + lifespan (scheduler de relatório)
├── requirements.txt               # Dependências Python
├── .env.example                   # Template de variáveis de ambiente
├── reciluz.db                     # Banco SQLite (gerado automaticamente)
└── app/
    ├── base.py                    # Base declarativa SQLAlchemy
    ├── database.py                # Sessão, init_db(), migrações SQLite
    ├── models.py                  # Lampada, Leitura, Assinante
    ├── schemas.py                 # Schemas Pydantic de request/response
    ├── routes/
    │   ├── lampada_routes.py      # /lampada/*
    │   ├── leituras_routes.py     # /leituras/*
    │   └── relatorio_routes.py    # /relatorio/*
    └── services/
        ├── lampada_service.py     # Lógica de controle da lâmpada
        ├── leituras_service.py    # Salvar e consultar leituras
        ├── nodered_service.py     # Cliente HTTP para Node-RED
        └── relatorio_service.py   # Geração e envio do relatório diário
```

---

## Executar localmente

```bash
cd backend
cp .env.example .env          # configure as variáveis
python3 -m venv venv
source venv/bin/activate      # Windows: venv\Scripts\activate
pip install -r requirements.txt
uvicorn main:app --reload
```

**Via Docker (recomendado):**
```bash
cd infra
docker compose up -d backend
```

API disponível em `http://localhost:8000` · Docs em `http://localhost:8000/docs`

---

## Endpoints

### Lâmpada
| Método | Rota | Descrição |
|---|---|---|
| `GET` | `/lampada/status` | Status atual |
| `POST` | `/lampada/ligar` | Liga (modo remoto) |
| `POST` | `/lampada/desligar` | Desliga (modo remoto) |
| `POST` | `/lampada/automatico` | Volta ao modo automático |

### Leituras
| Método | Rota | Descrição |
|---|---|---|
| `POST` | `/leituras` | Salva leitura do ESP32 (via Node-RED) |
| `GET` | `/leituras?limite=100` | Lista leituras recentes |
| `GET` | `/leituras/ultimas` | Última leitura da lâmpada 1 |

### Relatório por E-mail
| Método | Rota | Descrição |
|---|---|---|
| `POST` | `/relatorio/assinar` | Inscreve `{"email": "..."}` |
| `POST` | `/relatorio/cancelar` | Cancela inscrição |
| `POST` | `/relatorio/enviar-agora` | Dispara envio imediato (teste) |

---

## Variáveis de ambiente (`.env`)

```dotenv
# Banco de dados
DATABASE_URL=sqlite:///./reciluz.db

# Node-RED
NODE_RED_COMMAND_URL=http://localhost:1880/comando-lampada

# Thresholds de alerta (opcionais)
ALERT_CORRENTE_A=1.0
ALERT_RUIDO_DB=70.0
ALERT_TEMPERATURA_C=35.0
ALERT_UMIDADE_PCT=85.0
ALERT_COOLDOWN_MIN=5

# E-mail SMTP (deixe SMTP_HOST vazio para desativar)
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USER=seu_email@gmail.com
SMTP_PASSWORD=senha_de_app_16_chars
SMTP_FROM=seu_email@gmail.com
ALERT_EMAIL_TO=destinatario@email.com

# Hora do envio diário (0-23, horário de Recife)
RELATORIO_HORA_ENVIO=8
```

---

## Banco de dados

SQLite gerenciado por SQLAlchemy. Tabelas criadas automaticamente no startup:

| Tabela | Descrição |
|---|---|
| `lampadas` | Registro das lâmpadas cadastradas |
| `leituras` | Histórico de leituras dos sensores |
| `assinantes` | E-mails inscritos no relatório diário |
