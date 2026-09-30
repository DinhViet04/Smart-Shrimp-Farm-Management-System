import uvicorn
from contextlib import asynccontextmanager
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from app.core.config import settings
from app.core.logging import logger
from app.api.v1.router import api_router
from app.services.default_knowledge import seed_default_knowledge
from app.services.rag_service import rag_service
from app.services.embedding_service import embedding_service

@asynccontextmanager
async def lifespan(app: FastAPI):
    # Startup: Seed initial 5T knowledge documents & check OpenAI
    logger.info("Starting up Smart Shrimp Farm AI Service (FastAPI RAG)...")
    seed_default_knowledge()
    embedding_service.refresh_client()
    rag_service.refresh_client()
    yield
    # Shutdown
    logger.info("Shutting down AI Service...")

app = FastAPI(
    title=settings.PROJECT_NAME,
    version=settings.VERSION,
    description="Microservice AI & Hybrid RAG cho Hệ thống Quản lý Trang trại Nuôi tôm Thông minh (SSFM)",
    lifespan=lifespan
)

# CORS Middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.CORS_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# API Routers
app.include_router(api_router, prefix=settings.API_V1_STR)

@app.get("/")
def read_root():
    return {
        "message": "Welcome to the Smart Shrimp Farm Management AI / RAG Service!",
        "version": settings.VERSION,
        "docs": "/docs",
        "apiV1": settings.API_V1_STR,
        "health": f"{settings.API_V1_STR}/health"
    }

if __name__ == "__main__":
    uvicorn.run(
        "main:app",
        host=settings.HOST,
        port=settings.PORT,
        reload=True
    )
