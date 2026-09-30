from fastapi import APIRouter
from app.api.v1.endpoints import health, chat, documents

api_router = APIRouter()

api_router.include_router(health.router, tags=["Health"])
api_router.include_router(chat.router, prefix="/chat", tags=["Chatbot RAG"])
api_router.include_router(documents.router, prefix="/documents", tags=["Knowledge Base"])
