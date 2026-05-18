"""
Main FastAPI application for ReciLuz backend.
"""

from pathlib import Path
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse
from fastapi.staticfiles import StaticFiles
from app.database import init_db
from app.routes import lampada_routes, leituras_routes
from app.schemas import MensagemResposta

# Import models to ensure they are registered with Base
from app.models import Lampada, Leitura

# Initialize FastAPI app
app = FastAPI(
    title="ReciLuz API",
    description="Backend API for ReciLuz IoT Smart Public Lighting Management System",
    version="1.0.0"
)

# Configure CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # Allow all origins for local development
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Initialize database
init_db()

# Include routes
app.include_router(lampada_routes.router)
app.include_router(leituras_routes.router)

FRONTEND_DIR = Path(__file__).parent.parent / "frontend"
STATIC_DIR = FRONTEND_DIR
app.mount("/static", StaticFiles(directory=STATIC_DIR), name="static")


@app.get("/", response_model=MensagemResposta)
def root():
    """
    Root endpoint to check API status.

    Returns:
        Status message
    """
    return {"mensagem": "API ReciLuz funcionando"}


@app.get("/dashboard", include_in_schema=False)
def dashboard():
    """
    Serve the ReciLuz dashboard.
    """
    return FileResponse(FRONTEND_DIR / "index.html")


# Health check endpoint
@app.get("/health")
def health_check():
    """
    Health check endpoint.

    Returns:
        Status message
    """
    return {"status": "OK"}


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)
