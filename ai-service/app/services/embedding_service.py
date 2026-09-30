import math
import re
from typing import List, Optional
from openai import OpenAI
from app.core.config import settings
from app.core.logging import logger

class EmbeddingService:
    def __init__(self):
        self._openai_client: Optional[OpenAI] = None
        self._init_openai()

    def _init_openai(self):
        api_key = settings.OPENAI_API_KEY or ""
        if api_key and not api_key.startswith("your_openai"):
            try:
                self._openai_client = OpenAI(api_key=api_key)
                logger.info("OpenAI Client initialized successfully for Vector Embeddings.")
            except Exception as e:
                logger.warning(f"Could not initialize OpenAI Client: {e}")
                self._openai_client = None
        else:
            self._openai_client = None

    def refresh_client(self):
        self._init_openai()

    def get_embedding(self, text: str) -> List[float]:
        """Tạo vector embedding 1536 chiều từ OpenAI hoặc fallback vectorizer cục bộ."""
        if self._openai_client:
            try:
                response = self._openai_client.embeddings.create(
                    model=settings.OPENAI_EMBEDDING_MODEL,
                    input=text.replace("\n", " ")
                )
                return response.data[0].embedding
            except Exception as e:
                logger.warning(f"OpenAI embedding call failed ({e}), using local semantic vectorizer.")
        
        return self._create_local_vector(text)

    def _create_local_vector(self, text: str, dimensions: int = 64) -> List[float]:
        """Fallback cục bộ: Băm từ ngữ nghĩa và chuẩn hóa vector cosine."""
        vector = [0.0] * dimensions
        words = re.findall(r'[\wà-ỹ]+', text.lower())
        if not words:
            return vector

        for word in words:
            # Hash function cho từ
            h = 0
            for char in word:
                h = ((h << 5) - h) + ord(char)
                h &= 0xFFFFFFFF
            idx = abs(h) % dimensions
            vector[idx] += 1.0

        # L2 Normalization
        norm = math.sqrt(sum(x * x for x in vector))
        if norm > 0:
            return [x / norm for x in vector]
        return vector

    @staticmethod
    def cosine_similarity(vec_a: List[float], vec_b: List[float]) -> float:
        """Tính Cosine Similarity giữa 2 vector."""
        if not vec_a or not vec_b:
            return 0.0
        length = min(len(vec_a), len(vec_b))
        if length == 0:
            return 0.0
            
        dot = sum(vec_a[i] * vec_b[i] for i in range(length))
        norm_a = math.sqrt(sum(vec_a[i] * vec_a[i] for i in range(length)))
        norm_b = math.sqrt(sum(vec_b[i] * vec_b[i] for i in range(length)))

        if norm_a == 0.0 or norm_b == 0.0:
            return 0.0
        return dot / (norm_a * norm_b)

embedding_service = EmbeddingService()
