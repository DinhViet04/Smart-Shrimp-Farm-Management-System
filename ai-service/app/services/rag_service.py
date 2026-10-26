import time
from typing import List, Dict, Any, Optional
from openai import OpenAI
from app.core.config import settings
from app.core.logging import logger
from app.schemas.chat_schema import (
    AskChatRequest, 
    AskChatResponse, 
    CitationSource, 
    PondRealtimeContext
)
from app.services.vector_store import vector_store

class RAGService:
    def __init__(self):
        self._openai_client: Optional[OpenAI] = None
        self._init_client()

    def _init_client(self):
        api_key = settings.OPENAI_API_KEY or ""
        if api_key and not api_key.startswith("your_openai"):
            try:
                self._openai_client = OpenAI(api_key=api_key)
                logger.info("OpenAI Client initialized for RAG text generation (model: %s).", settings.OPENAI_CHAT_MODEL)
            except Exception as e:
                logger.warning(f"Could not initialize OpenAI client for chat: {e}")
                self._openai_client = None
        else:
            self._openai_client = None

    def refresh_client(self):
        self._init_client()

    def ask(self, request: AskChatRequest) -> AskChatResponse:
        """Thực thi pipeline RAG: Retrieval -> Context Augmentation -> Generation."""
        start_time = time.time()
        question = request.question.strip()
        
        if not question:
            return AskChatResponse(
                answer="Vui lòng nhập câu hỏi của bạn.",
                executionTimeSeconds=0.0
            )

        # 1. RETRIEVAL: Tìm kiếm Top-3 chunks tương quan nhất
        matched_chunks = vector_store.similarity_search(query=question, top_k=3, min_score=0.15)
        
        sources: List[CitationSource] = []
        context_docs_text = []

        for idx, chunk in enumerate(matched_chunks):
            sources.append(CitationSource(
                documentTitle=chunk["documentTitle"],
                category=chunk.get("category"),
                chunkIndex=chunk["chunkIndex"],
                snippet=chunk["content"][:160] + "...",
                relevanceScore=chunk["score"]
            ))
            context_docs_text.append(f"[TÀI LIỆU {idx + 1} - \"{chunk['documentTitle']}\"]:\n{chunk['content']}")

        knowledge_context = "\n\n".join(context_docs_text) if context_docs_text else "Không tìm thấy đoạn trích phù hợp trong kho cẩm nang."

        # 2. DYNAMIC POND CONTEXT INJECTION: Dữ liệu thực tế ao nuôi
        pond_ctx_text = ""
        target_pond_name = None
        recommendations: List[str] = []

        if request.pondContext:
            p = request.pondContext
            target_pond_name = p.pondName
            pond_ctx_text = f"\n[DỮ LIỆU THỰC TẾ AO NUÔI: {p.pondName or 'AO ĐƯỢC CHỌN'}]:\n"
            if p.farmName:
                pond_ctx_text += f"- Trang trại: {p.farmName}\n"
            if p.areaSize:
                pond_ctx_text += f"- Diện tích: {p.areaSize} m² (Độ sâu: {p.depth or 1.2} m)\n"
            if p.doc is not None:
                pond_ctx_text += f"- Ngày nuôi (DOC): {p.doc} ngày\n"
            if p.initialShrimpCount:
                pond_ctx_text += f"- Số lượng giống thả: {p.initialShrimpCount:,} con\n"
            if p.stage:
                pond_ctx_text += f"- Giai đoạn: {p.stage}\n"

            if p.latestWaterQuality:
                w = p.latestWaterQuality
                pond_ctx_text += f"- Chỉ số đo nước gần nhất: pH: {w.ph or 'Chưa đo'}, DO (Oxy): {w.dissolvedOxygen or 'Chưa đo'} mg/L, Độ mặn: {w.salinity or 'Chưa đo'}‰, Nhiệt độ: {w.temperature or 'Chưa đo'}°C, NH3: {w.nh3 or 'Chưa đo'} mg/L, NO2: {w.no2 or 'Chưa đo'} mg/L\n"
                
                # Rule-based auto recommendations
                if w.ph and (w.ph < 7.5 or w.ph > 8.3):
                    recommendations.append(f"Hiệu chỉnh độ pH ({w.ph}) về khoảng an toàn 7.5 - 8.3")
                if w.dissolvedOxygen and w.dissolvedOxygen < 4.5:
                    recommendations.append(f"Tăng cường sục khí & quạt nước ngay (DO hiện tại {w.dissolvedOxygen} mg/L)")
                if w.nh3 and w.nh3 > 0.1:
                    recommendations.append(f"Khí độc NH3 cao ({w.nh3} mg/L) - Cần giảm thức ăn và tạt vi sinh Yucca")

        # 3. LLM INFERENCE (OpenAI GPT-4o-mini)
        if self._openai_client and settings.OPENAI_API_KEY:
            try:
                system_prompt = f"""Bạn là Trợ Lý Kỹ Thuật Nuôi Tôm Thông Minh AI của hệ thống Smart Shrimp Farm Management (SSFM).
Nhiệm vụ của bạn là giải đáp chuyên môn sâu sắc dựa trên TÀI LIỆU KHO TRI THỨC VÀ SỐ LIỆU ĐO NƯỚC THỰC TẾ dưới đây.

{pond_ctx_text}

KHO TÀI LIỆU KỸ THUẬT (RAG CONTEXT):
{knowledge_context}

YÊU CẦU TRẢ LỜI:
1. Trả lời bằng tiếng Việt chuyên nghiệp, thân thiện, rõ ràng, gạch đầu dòng các ý chính.
2. Nếu có dữ liệu ao thực tế, hãy đối chiếu chỉ số đo với chuẩn cẩm nang và đưa ra phác đồ cấp bách theo thứ tự ưu tiên 1, 2, 3.
3. Luôn nêu rõ nguồn cẩm nang tham khảo ở cuối câu trả lời."""

                messages = [{"role": "system", "content": system_prompt}]
                
                # History (nếu có)
                if request.conversationHistory:
                    for hist in request.conversationHistory[-4:]:
                        messages.append({"role": hist.role, "content": hist.content})

                messages.append({"role": "user", "content": question})

                completion = self._openai_client.chat.completions.create(
                    model=settings.OPENAI_CHAT_MODEL,
                    messages=messages,
                    temperature=0.3
                )
                answer_text = completion.choices[0].message.content or ""
            except Exception as err:
                logger.error(f"OpenAI completion error: {err}")
                answer_text = self._build_fallback_answer(question, matched_chunks, pond_ctx_text)
        else:
            answer_text = self._build_fallback_answer(question, matched_chunks, pond_ctx_text)

        exec_time = round(time.time() - start_time, 3)
        return AskChatResponse(
            answer=answer_text,
            sources=sources,
            pondName=target_pond_name,
            recommendations=recommendations,
            executionTimeSeconds=exec_time
        )

    def _build_fallback_answer(self, question: str, matches: List[Dict[str, Any]], pond_ctx: str) -> str:
        res = ""
        if pond_ctx:
            res += f"{pond_ctx}\n"

        if matches:
            res += "📚 **Dựa trên cẩm nang kỹ thuật nuôi tôm của trang trại:**\n\n"
            for m in matches:
                res += f"• **Trích từ \"{m['documentTitle']}\" (Độ phù hợp {int(m['score']*100)}%):**\n{m['content']}\n\n"
            res += "💡 *Khuyến nghị:* Hãy kiểm tra kỹ các thông số ao thực tế vào mỗi buổi sáng và chiều để điều chỉnh môi trường kịp thời."
        else:
            res += f"🤖 Cảm ơn bạn đã đặt câu hỏi về: **\"{question}\"**.\n\n" \
                   f"Hiện tại trong kho tri thức chưa có đoạn trích nào khớp chính xác. Bạn có thể tải thêm tài liệu quy trình vào hệ thống hoặc hỏi về: **Độ pH, Oxy hòa tan DO, FCR, Khí độc NH3/NO2, và Bệnh phân trắng**."
        return res

rag_service = RAGService()
