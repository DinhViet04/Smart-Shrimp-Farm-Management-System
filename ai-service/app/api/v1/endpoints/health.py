from fastapi import APIRouter
from app.core.config import settings
from app.services.vector_store import vector_store

router = APIRouter()

@router.get("/health")
def health_check():
    docs_count = len(vector_store.documents)
    chunks_count = len(vector_store.chunks)
    has_openai_key = bool(settings.OPENAI_API_KEY and not settings.OPENAI_API_KEY.startswith("your_openai"))
    
    return {
        "status": "healthy",
        "service": settings.PROJECT_NAME,
        "version": settings.VERSION,
        "openaiConnected": has_openai_key,
        "chatModel": settings.OPENAI_CHAT_MODEL,
        "embeddingModel": settings.OPENAI_EMBEDDING_MODEL,
        "knowledgeBase": {
            "documents": docs_count,
            "vectorChunks": chunks_count
        }
    }
