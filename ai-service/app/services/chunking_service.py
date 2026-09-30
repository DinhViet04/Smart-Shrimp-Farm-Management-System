import re
from typing import List
import io
from pypdf import PdfReader
from app.core.logging import logger

class ChunkingService:
    def __init__(self, chunk_size: int = 600, chunk_overlap: int = 100):
        self.chunk_size = chunk_size
        self.chunk_overlap = chunk_overlap

    def split_text(self, text: str) -> List[str]:
        """Cắt nhỏ văn bản thành các đoạn ~600 ký tự với độ gối đầu overlap 100 ký tự."""
        if not text:
            return []
        text = text.strip()
        if len(text) <= self.chunk_size:
            return [text]

        chunks: List[str] = []
        start_idx = 0

        while start_idx < len(text):
            end_idx = start_idx + self.chunk_size

            if end_idx < len(text):
                # Tìm dấu ngắt câu hợp lý (xuống dòng, chấm câu, chấm hỏi)
                sub_text = text[start_idx:end_idx]
                punctuation_pos = max(
                    sub_text.rfind('\n'),
                    sub_text.rfind('. '),
                    sub_text.rfind('? '),
                    sub_text.rfind('; ')
                )

                if punctuation_pos > 150:
                    end_idx = start_idx + punctuation_pos + 1

            chunk = text[start_idx:end_idx].strip()
            if len(chunk) > 25:
                chunks.append(chunk)

            start_idx = end_idx - self.chunk_overlap
            if start_idx >= len(text) - self.chunk_overlap:
                break

        return chunks

    def extract_text_from_pdf(self, pdf_bytes: bytes) -> str:
        """Đọc văn bản từ file PDF."""
        try:
            reader = PdfReader(io.BytesIO(pdf_bytes))
            text = ""
            for page in reader.pages:
                extracted = page.extract_text()
                if extracted:
                    text += extracted + "\n"
            return text.strip()
        except Exception as e:
            logger.error(f"Error extracting text from PDF: {e}")
            raise ValueError(f"Không thể đọc file PDF: {str(e)}")

chunking_service = ChunkingService()
