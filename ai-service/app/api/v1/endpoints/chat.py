from fastapi import APIRouter, HTTPException
from app.schemas.chat_schema import AskChatRequest, AskChatResponse
from app.services.rag_service import rag_service
from app.core.logging import logger

router = APIRouter()

@router.post("/ask", response_model=AskChatResponse)
def ask_chatbot(request: AskChatRequest):
    """
    Endpoint RAG Chatbot:
    - Nhận câu hỏi và dữ liệu môi trường ao thực tế.
    - Tìm kiếm Top-3 đoạn cẩm nang liên quan trong Vector Store.
    - Gọi OpenAI GPT-4o-mini sinh câu trả lời có cấu trúc kèm nguồn trích dẫn.
    """
    try:
        return rag_service.ask(request)
    except Exception as e:
        logger.error(f"Error in ask_chatbot endpoint: {e}")
        raise HTTPException(status_code=500, detail=str(e))
