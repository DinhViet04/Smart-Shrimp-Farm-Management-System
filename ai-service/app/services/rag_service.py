import time
import re
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

    def _is_weather_inquiry(self, text: str) -> bool:
        if not text:
            return False
        q = text.lower().strip()

        # 1. Các câu hỏi kỹ thuật nuôi tôm (dù có từ bão, mưa cũng không phải hỏi thời tiết thực tế)
        technical_keywords = [
            "phải như thế nào", "như thế nào", "the nao", "làm sao", "lam sao", "làm gì", "lam gi",
            "xử lý", "xu ly", "phòng ngừa", "phong ngua", "phác đồ", "phac do",
            "cho ăn", "cho an", "giảm ăn", "giam an", "cắt cữ", "cat cu",
            "bị sốc", "bi soc", "đục cơ", "duc co", "tôm", "ao", "nếu trời", "khi trời", "chuẩn bị gì"
        ]
        is_technical = any(kw in q for kw in technical_keywords)

        # 2. Câu hỏi trực tiếp hỏi về thời tiết thực tế / dự báo thời tiết
        explicit_weather = [
            "thời tiết hôm nay", "thoi tiet hom nay",
            "thời tiết hiện tại", "thoi tiet hien tai",
            "thời tiết ngày mai", "thoi tiet ngay mai",
            "dự báo thời tiết", "du bao thoi tiet",
            "dự báo", "du bao",
            "thời tiết thế nào", "thoi tiet the nao",
            "thời tiết ra sao", "thoi tiet ra sao",
            "thời tiết sao", "thoi tiet sao",
            "thời tiết ở", "thoi tiet o",
            "thời tiết tại", "thoi tiet tai",
            "thời tiết khu vực", "thoi tiet khu vuc",
            "hôm nay trời có mưa không", "hom nay troi co mua khong",
            "hôm nay có mưa không", "hom nay co mua khong",
            "trời hôm nay thế nào", "troi hom nay the nao",
            "nhiệt độ hôm nay", "nhiet do hom nay",
            "nhiệt độ hiện tại", "nhiet do hien tai",
            "nhiệt độ ngoài trời", "nhiet do ngoai troi",
            "độ ẩm không khí", "do am khong khi",
            "có bão không", "co bao khong",
            "sắp có bão không", "sap co bao khong",
            "weather", "forecast"
        ]

        if any(kw in q for kw in explicit_weather):
            return True

        if is_technical:
            return False

        secondary_weather = [
            "thời tiết", "thoi tiet", "có mưa không", "co mua khong",
            "mưa không", "mua khong", "sắp mưa", "sap mua", "hôm nay trời", "hom nay troi"
        ]
        if any(kw in q for kw in secondary_weather):
            return True

        if "nhiệt độ" in q or "nhiet do" in q:
            if not any(w in q for w in ["nước", "nuoc", "ao", "thích hợp", "thich hop"]):
                return True

        return False

    def _is_casual_greeting(self, text: str) -> bool:
        if not text:
            return False
        import re
        q = text.lower().strip()
        patterns = [
            r"^(chào|xin chào|hello|hi|helo|alo|hey|ê|hế lô)(\s+.*)?$",
            r"^(tao|tôi|mình|anh|chị|em)\s+tên\s+(là\s+)?([a-zA-ZÀ-ỹ\s]+)$",
            r"^(bạn|mày|em)\s+là\s+ai",
            r"^(giới thiệu|gioi thieu)(\s+về\s+bạn)?",
            r"^(cảm ơn|cam on|thanks|thank you|ok|oke|được rồi|tạm biệt|bye)$",
            r"^test$",
        ]
        return any(re.match(p, q, re.IGNORECASE) for p in patterns)

    def ask(self, request: AskChatRequest) -> AskChatResponse:
        """Thực thi pipeline RAG: Retrieval -> Context Augmentation -> Generation."""
        start_time = time.time()
        question = request.question.strip()
        
        if not question:
            return AskChatResponse(
                answer="Vui lòng nhập câu hỏi của bạn.",
                executionTimeSeconds=0.0
            )

        is_greeting = self._is_casual_greeting(question)
        is_weather_query = self._is_weather_inquiry(question)

        # 1. RETRIEVAL: Tìm kiếm Top-3 chunks tương quan nhất
        # Nếu là câu chào hỏi, không tìm kiếm chunk cẩm nang để tránh đưa tài liệu không liên quan
        matched_chunks = []
        if not is_greeting:
            raw_chunks = vector_store.similarity_search(query=question, top_k=3, min_score=0.40)
            # Chỉ giữ các chunk có độ khớp thực sự (>= 0.40)
            matched_chunks = [c for c in raw_chunks if c.get("score", 0) >= 0.40]

        has_high_relevance_local = any(chunk.get("score", 0) >= 0.55 for chunk in matched_chunks)
        
        sources: List[CitationSource] = []
        context_docs_text = []
        source_type = None

        if has_high_relevance_local:
            source_type = "LOCAL_DOCUMENT"
            for idx, chunk in enumerate(matched_chunks):
                sources.append(CitationSource(
                    documentTitle=chunk["documentTitle"],
                    category=chunk.get("category"),
                    chunkIndex=chunk["chunkIndex"],
                    snippet=chunk["content"][:160] + "...",
                    relevanceScore=chunk["score"]
                ))
                context_docs_text.append(f"[TÀI LIỆU CẨM NANG {idx + 1} - \"{chunk['documentTitle']}\" (Độ khớp {int(chunk['score']*100)}%)]:\n{chunk['content']}")
        elif matched_chunks:
            source_type = "HYBRID"
            for idx, chunk in enumerate(matched_chunks):
                sources.append(CitationSource(
                    documentTitle=chunk["documentTitle"],
                    category=chunk.get("category"),
                    chunkIndex=chunk["chunkIndex"],
                    snippet=chunk["content"][:160] + "...",
                    relevanceScore=chunk["score"]
                ))
                context_docs_text.append(f"[TÀI LIỆU THAM KHẢO {idx + 1} - \"{chunk['documentTitle']}\"]:\n{chunk['content']}")

        knowledge_context = "\n\n".join(context_docs_text) if context_docs_text else "Không có tài liệu cẩm nang nội bộ nào liên quan trực tiếp đến câu hỏi này."

        # 2. DYNAMIC POND CONTEXT INJECTION: Dữ liệu thực tế ao nuôi
        pond_ctx_text = ""
        target_pond_name = None
        recommendations: List[str] = []

        if request.pondContext:
            p = request.pondContext
            target_pond_name = p.pondName

            # Tính waterVolume nếu chưa có (backend mới sẽ gửi sẵn, fallback tính lại)
            area = p.areaSize or 0
            dep = p.depth or 1.2
            water_vol = round(p.waterVolume, 2) if p.waterVolume else round(area * dep, 2)

            pond_ctx_text = f"\n[DỮ LIỆU THỰC TẾ AO NUÔI: {p.pondName or 'AO ĐƯỢC CHỌN'} - DÙNG ĐỂ TÍNH LIỀU LƯỢNG THUỐC CHÍNH XÁC]:\n"
            if p.farmName:
                pond_ctx_text += f"- Trang trại: {p.farmName}\n"
            if area:
                pond_ctx_text += f"- Diện tích ao: {area} m²\n"
                pond_ctx_text += f"- Độ sâu trung bình: {dep} m\n"
                pond_ctx_text += f"- ⚠️ THỂ TÍCH NƯỚC AO (ĐÃ TÍNH): {water_vol} m³ (= {area} m² × {dep} m) — AI BẮT BUỘC dùng số này để tính tổng lượng thuốc/hóa chất cần dùng cho ao\n"
            if p.doc is not None:
                pond_ctx_text += f"- Ngày nuôi (DOC): {p.doc} ngày\n"
            if p.initialShrimpCount:
                pond_ctx_text += f"- Số lượng giống thả: {p.initialShrimpCount:,} con\n"
            if p.shrimpDensity:
                pond_ctx_text += f"- Mật độ nuôi: {p.shrimpDensity} con/m²\n"
            if p.stage:
                pond_ctx_text += f"- Giai đoạn phát triển: {p.stage}\n"

            if p.latestWaterQuality and not is_greeting:
                w = p.latestWaterQuality
                pond_ctx_text += f"- Chỉ số đo nước gần nhất: pH: {w.ph or 'Chưa đo'}, DO (Oxy): {w.dissolvedOxygen or 'Chưa đo'} mg/L, Độ mặn: {w.salinity or 'Chưa đo'}‰, Nhiệt độ: {w.temperature or 'Chưa đo'}°C, NH3: {w.nh3 or 'Chưa đo'} mg/L, NO2: {w.no2 or 'Chưa đo'} mg/L{f', Kiềm: {w.alkalinity} mg/L' if w.alkalinity else ''}\n"
                
                # Rule-based auto recommendations
                if w.ph and (w.ph < 7.5 or w.ph > 8.3):
                    recommendations.append(f"Hiệu chỉnh độ pH ({w.ph}) về khoảng an toàn 7.5 - 8.3")
                if w.dissolvedOxygen and w.dissolvedOxygen < 4.5:
                    recommendations.append(f"Tăng cường sục khí & quạt nước ngay (DO hiện tại {w.dissolvedOxygen} mg/L)")
                if w.nh3 and w.nh3 > 0.1:
                    recommendations.append(f"Khí độc NH3 cao ({w.nh3} mg/L) - Cần giảm thức ăn và tạt vi sinh Yucca")

            if p.inventory:
                pond_ctx_text += f"\n[DANH MỤC THUỐC & HÓA CHẤT HIỆN CÓ TRONG KHO VẬT TƯ CỦA TRANG TRẠI (TỔNG CỘNG: {len(p.inventory)} MẶT HÀNG)]:\n"
                for idx, item in enumerate(p.inventory):
                    cat_name = "Thuốc / Men vi sinh" if item.get("category") == "MEDICINE" else "Hóa chất / Khoáng" if item.get("category") == "CHEMICAL" else item.get("category", "")
                    pond_ctx_text += f"- [{idx + 1}] Tên: \"{item.get('itemName') or item.get('name')}\" | Loại: {cat_name} | Tồn kho thực tế: {item.get('quantity')} {item.get('unit')}"
                    if item.get("description"):
                        pond_ctx_text += f" | Công dụng: {item.get('description')}"
                    pond_ctx_text += "\n"

            # CHỈ ĐƯA THỜI TIẾT VÀO CONTEXT KHI NGƯỜI DÙNG THỰC SỰ HỎI VỀ THỜI TIẾT
            if p.weather and is_weather_query:
                wt = p.weather
                pond_ctx_text += f"\n[DỮ LIỆU THỜI TIẾT THỰC TẾ HÔM NAY - KHU VỰC {(wt.cityName or 'TRANG TRẠI').upper()}]:\n"
                if wt.temperature is not None:
                    pond_ctx_text += f"- Nhiệt độ không khí: {wt.temperature}°C (Cảm giác: {wt.feelsLike or wt.temperature}°C)\n"
                if wt.description:
                    pond_ctx_text += f"- Hiện trạng thời tiết: {wt.description}\n"
                if wt.humidity is not None:
                    pond_ctx_text += f"- Độ ẩm: {wt.humidity}% | Áp suất: {wt.pressure or 1010} hPa\n"
                if wt.windSpeed is not None:
                    pond_ctx_text += f"- Tốc độ gió: {wt.windSpeed} m/s\n"
                if wt.rain1h is not None and wt.rain1h > 0:
                    pond_ctx_text += f"- Lượng mưa: {wt.rain1h} mm (Đang có mưa)\n"
                elif wt.isRaining:
                    pond_ctx_text += f"- Trạng thái: Đang có mưa\n"
                if wt.recordedAt:
                    pond_ctx_text += f"- Thời điểm ghi nhận: {wt.recordedAt} ({wt.provider or 'Dữ liệu thời gian thực'})\n"

                # Rule-based auto weather recommendations
                if wt.isRaining:
                    recommendations.append(f"Thời tiết đang mưa ({wt.description}) - Bật quạt sục khí liên tục, tạt vôi đệm pH và kiểm tra DO đáy ao")
                elif wt.isHot:
                    recommendations.append(f"Thời tiết nắng nóng gay gắt ({wt.temperature}°C) - Tránh kéo nhá lúc trưa, che lưới lan giảm sốc nhiệt")
                elif wt.isCold:
                    recommendations.append(f"Thời tiết lạnh ({wt.temperature}°C) - Cắt giảm 50% thức ăn, tránh xáo động đáy ao")
                elif wt.isWindy:
                    recommendations.append(f"Gió mạnh ({wt.windSpeed} m/s) - Kiểm tra bờ ao và hệ thống lưới chắn gió")

        # 3. LLM INFERENCE (OpenAI GPT-4o-mini)
        if self._openai_client and settings.OPENAI_API_KEY:
            try:
                system_prompt = f"""Bạn là Trợ Lý Kỹ Thuật Nuôi Tôm Thông Minh AI của hệ thống Smart Shrimp Farm Management (SSFM).
Nhiệm vụ của bạn là tư vấn, giải đáp chuyên môn kỹ thuật sâu sắc, tận tâm và mang tính ứng dụng thực tế cao cho người nuôi tôm và kỹ thuật viên trang trại.

{pond_ctx_text}

KHO TÀI LIỆU CẨM NANG NỘI BỘ TRANG TRẠI (RAG CONTEXT):
{knowledge_context}

NGUYÊN TẮC XỬ LÝ NGUỒN TRI THỨC (BẮT BUỘC TUÂN THỦ):
1. [ƯU TIÊN SỐ 1 - CẨM NANG NỘI BỘ & SỐ LIỆU AO]:
   - Nếu KHO TÀI LIỆU CẨM NANG NỘI BỘ ở trên có thông tin/quy trình/số liệu liên quan đến câu hỏi, bạn BẮT BUỘC PHẢI ƯU TIÊN SỐ 1 sử dụng thông tin này để làm căn cứ cốt lõi trả lời.
   - Nếu có dữ liệu ao thực tế (pH, DO, NH3, NO2, DOC, diện tích,...), hãy đối chiếu sát sao với chỉ số cẩm nang để đưa ra phác đồ cấp bách theo thứ tự ưu tiên 1, 2, 3.

2. [ƯU TIÊN SỐ 2 - TRI THỨC MỞ RỘNG TỪ CHUYÊN GIA AI OPENAI]:
   - Nếu cẩm nang nội bộ KHÔNG CÓ hoặc KHÔNG ĐỦ CHI TIẾT để giải đáp trọn vẹn thắc mắc của người nuôi, bạn TUYỆT ĐỐI KHÔNG TỪ CHỐI BỎ CUỘC.
   - Hãy tự động khai thác KHO TRI THỨC CHUYÊN SÂU CỦA BẠN (về sinh học tôm thẻ chân trắng/tôm sú, quản lý hóa lý nước, bệnh học thủy sản, dinh dưỡng & FCR, công nghệ biofloc/RAS, tiêu chuẩn quốc tế) để giải thích cặn kẽ, khoa học và đưa ra phác đồ thực hành rõ ràng.

3. [XỬ LÝ DỮ LIỆU THỜI TIẾT]:
   - CHỈ ĐỀ CẬP ĐẾN THỜI TIẾT KHI NGƯỜI DÙNG CÓ HỎI VỀ THỜI TIẾT.
   - Nếu câu hỏi KHÔNG hỏi về thời tiết (chào hỏi, hỏi kỹ thuật thông thường), TUYỆT ĐỐI KHÔNG tự tiện chèn thông tin hay cảnh báo thời tiết vào câu trả lời.
   - Khi người dùng hỏi về thời tiết, hãy dùng dữ liệu thời tiết thực tế được cấp để trả lời ngay các thông số: Nhiệt độ, mưa/nắng, độ ẩm, gió và kết hợp hướng dẫn biện pháp kỹ thuật phòng ngừa.

4. [QUY TẮC TRÌNH BÀY & NGUỒN THAM KHẢO]:
   - TUYỆT ĐỐI KHÔNG thêm bất kỳ dòng ghi chú nào về "Nguồn tham khảo", "Cẩm nang", "Tài liệu" hay "Tri thức OpenAI" ở cuối câu trả lời.
   - Trả lời trực tiếp vào câu hỏi bằng tiếng Việt chuyên nghiệp, giọng điệu kỹ sư giàu kinh nghiệm, thân thiện, dễ hiểu.
   - Bố cục rõ ràng: Dùng gạch đầu dòng, in đậm các từ khóa, liều lượng, số liệu quan trọng.

5. [TÍNH LIỀU LƯỢNG THUỐC/HÓA CHẤT CHÍNH XÁC THEO DỮ LIỆU AO THỰC TẾ - BẮT BUỘC TUYỆT ĐỐI]:
   Khi tư vấn về thuốc, hóa chất, khoáng chất, men vi sinh hoặc bất kỳ chế phẩm nào cần dùng cho ao:
   a. BẮT BUỘC SỬ DỤNG CÁC SỐ LIỆU AO SAU ĐÂY ĐỂ TÍNH LIỀU LƯỢNG THỰC TẾ:
      - Thể tích nước ao (m³) = [đọc từ DỮ LIỆU THỰC TẾ AO NUÔI ở trên, đã được tính sẵn: THỂ TÍCH NƯỚC AO (ĐÃ TÍNH)]
      - Diện tích ao (m²) = [đọc từ DỮ LIỆU THỰC TẾ AO NUÔI ở trên]
      - Số lượng tôm (con) và mật độ (con/m²) = [đọc từ DỮ LIỆU THỰC TẾ AO NUÔI ở trên]
   b. Công thức tính liều lượng PHẢI HIỂN THỊ RÕ RÀNG:
      - Nếu liều chuẩn tính theo m³ nước: Tổng lượng cần dùng = [liều mg/L hoặc g/m³] × [thể tích ao m³]
      - Nếu liều chuẩn tính theo m² diện tích ao: Tổng lượng = [liều g/m² hoặc mL/m²] × [diện tích ao m²]
      - Nếu liều chuẩn tính theo kg tôm sinh khối: ước tính sinh khối = [số lượng tôm] × [khối lượng trung bình ước tính theo DOC] rồi tính tổng lượng
      - Ví dụ trình bày: "Liều chuẩn: 2 g/m³ → Ao X m³ cần dùng: **X × 2 = Y g** tổng cộng"
   c. Luôn nêu rõ: Cách pha loãng (hòa trong bao nhiêu lít nước trước khi tạt), thời điểm tạt trong ngày, tần suất sử dụng.

6. [ĐỐI CHIẾU VỚI KHO THUỐC & VẬT TƯ CỦA TRANG TRẠI (QUAN TRỌNG NHẤT)]:
   - Khi tư vấn xử lý sự cố, dịch bệnh, hoặc cải tạo môi trường nước, bạn BẮT BUỘC phải tra cứu danh sách [DANH MỤC THUỐC & HÓA CHẤT HIỆN CÓ TRONG KHO VẬT TƯ CỦA TRANG TRẠI] được cung cấp ở trên để đối chiếu xem trang trại đang CÓ SẴN loại nào và CHƯA CÓ loại nào.
   - Đối với thuốc/hóa chất CÓ TRONG KHO:
     + Ghi rõ: ✅ [CÓ SẴN TRONG KHO - Tồn: X <đơn vị>]
     + Tư vấn công dụng, tính toán LIỀU LƯỢNG TUYỆT ĐỐI cần dùng cho ao (theo quy tắc số 5 ở trên), thời điểm và cách thức tạt/trộn cho ăn.
   - Đối với thuốc/hóa chất KHÔNG CÓ TRONG KHO (hoặc kho chưa có loại phù hợp):
     + Ghi rõ thông báo: ⚠️ [KHO HIỆN CHƯA CÓ THUỐC NÀY - Cần mua bổ sung]
     + LƯU Ý ĐẶC BIỆT: Dù kho chưa có thuốc, bạn VẪN PHẢI NÊU ĐẦY ĐỦ: Tên thuốc/hoạt chất đề xuất, Công dụng chuyên biệt của thuốc, LIỀU LƯỢNG đã tính sẵn theo số liệu ao thực tế (quy tắc số 5) và Cách sử dụng chi tiết để kỹ thuật viên nắm rõ đi mua hoặc nhập kho kịp thời.
     + Nếu trong kho có sản phẩm khác có thể thay thế tạm thời, hãy gợi ý phương án thay thế từ kho."""

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

        answer_text = self._strip_reference_sources(answer_text)
        exec_time = round(time.time() - start_time, 3)
        return AskChatResponse(
            answer=answer_text,
            sources=[],
            pondName=target_pond_name,
            recommendations=recommendations,
            sourceType=None,
            hasLocalKnowledge=False,
            weather=None,
            executionTimeSeconds=exec_time
        )

    def _strip_reference_sources(self, text: str) -> str:
        if not text:
            return ""
        cleaned = re.sub(
            r'(?:\r?\n)+\s*(?:📖\s*|📚\s*)?(?:Nguồn\s*(?:tham\s*khảo|trích\s*dẫn)?|Tài\s*liệu\s*tham\s*khảo|Cẩm\s*nang\s*tham\s*khảo)[\s\S]*$',
            '',
            text,
            flags=re.IGNORECASE
        )
        return cleaned.strip()

    def _build_fallback_answer(self, question: str, matches: List[Dict[str, Any]], pond_ctx: str) -> str:
        res = ""
        if pond_ctx:
            res += f"{pond_ctx}\n"

        if matches:
            for m in matches:
                res += f"{m['content']}\n\n"
            res += "💡 *Khuyến nghị:* Hãy kiểm tra kỹ các thông số ao thực tế vào mỗi buổi sáng và chiều để điều chỉnh môi trường kịp thời."
        else:
            res += f"🤖 Cảm ơn bạn đã đặt câu hỏi về: **\"{question}\"**.\n\n" \
                   f"Hiện tại trong kho tri thức nội bộ chưa có đoạn trích nào khớp chính xác với câu hỏi này (Hệ thống đang chạy ngoại tuyến không kết nối OpenAI).\n\n" \
                   f"Bạn có thể hỏi về các chủ đề: **Độ pH, Oxy hòa tan DO, FCR, Khí độc NH3/NO2, và Bệnh phân trắng**."
        return res

rag_service = RAGService()
