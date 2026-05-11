# ReciLuz Backend

Backend em Python com FastAPI para o ReciLuz - Sistema IoT de Gestão Inteligente de Iluminação Pública.

## 📁 Estrutura do Backend

```
backend/
├── requirements.txt          # Dependências Python
├── .env.example              # Variáveis de ambiente
├── main.py                   # Aplicação FastAPI
└── app/
    ├── base.py               # Base SQLAlchemy
    ├── database.py           # Configuração do banco
    ├── models.py             # Modelos (Lampada, Leitura)
    ├── schemas.py            # Schemas Pydantic
    ├── routes/
    │   ├── lampada_routes.py
    │   └── leituras_routes.py
    └── services/
        ├── lampada_service.py
        ├── leituras_service.py
        └── nodered_service.py
```

## ⚙️ Como Inicializar

### 1. Pré-requisitos
- Python 3.8+
- pip

### 2. Acessar a pasta
```bash
cd Project-ReciLuz/backend
```

### 3. Criar arquivo `.env`
```bash
cp .env.example .env
```

### 4. Criar e ativar ambiente virtual
```bash
# macOS / Linux
python3 -m venv venv
source venv/bin/activate

# Windows
python -m venv venv
venv\Scripts\activate
```

### 5. Instalar dependências
```bash
pip install -r requirements.txt
```

### 6. Executar
```bash
uvicorn main:app --reload
```

API disponível em: **http://localhost:8000**

Documentação: **http://localhost:8000/docs**

## 📌 Endpoints Principais

- `GET /` - Status da API
- `GET /lampada/status` - Status da lâmpada
- `POST /lampada/ligar` - Ligar lâmpada
- `POST /lampada/desligar` - Desligar lâmpada
- `POST /leituras` - Salvar leitura (Node-RED)
- `GET /leituras` - Listar leituras
- `GET /leituras/ultimas` - Última leitura

## 🗄️ Banco de Dados

**SQLite** com tabelas:
- `lampadas` (id, nome, status, criada_em, atualizada_em)
- `leituras` (id, lampada_id, status_lampada, intensidade_pwm, corrente, potencia, consumo_estimado, presenca_detectada, temperatura, umidade, qualidade_ar, criada_em)

## 🔌 Integração Node-RED

O Node-RED faz POST para: `http://localhost:8000/leituras`

Payload:
```json
{
  "lampada_id": 1,
  "status_lampada": "ligada",
  "intensidade_pwm": 180,
  "corrente": 0.85,
  "potencia": 10.2,
  "consumo_estimado": 0.015,
  "presenca_detectada": true,
  "temperatura": null,
  "umidade": null,
  "qualidade_ar": null
}
```

## 🛑 Parar a aplicação

Pressionar `Ctrl+C` no terminal.

---

**Desenvolvido para o projeto ReciLuz**
