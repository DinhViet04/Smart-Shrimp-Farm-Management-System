import json
import uuid
from typing import List, Dict, Any, Optional
from datetime import datetime
from pathlib import Path
from app.core.config import settings
from app.core.logging import logger
from app.services.embedding_service import embedding_service
from app.services.chunking_service import chunking_service

class VectorStoreService:
    def __init__(self):
        self.store_path: Path = settings.VECTOR_STORE_PATH
        self.documents: Dict[str, Dict[str, Any]] = {}
        self.chunks: List[Dict[str, Any]] = []
        self._load_from_disk()

    def _load_from_disk(self):
        """Nạp dữ liệu vector store từ file JSON cục bộ."""
        if not settings.DATA_DIR.exists():
            settings.DATA_DIR.mkdir(parents=True, exist_ok=True)

        if self.store_path.exists():
            try:
                with open(self.store_path, "r", encoding="utf-8") as f:
                    data = json.load(f)
                    self.documents = data.get("documents", {})
                    self.chunks = data.get("chunks", [])
                logger.info(f"Loaded {len(self.documents)} documents and {len(self.chunks)} vector chunks from {self.store_path}")
            except Exception as e:
                logger.warning(f"Failed to load vector store from disk ({e}), starting clean.")
                self.documents = {}
                self.chunks = []

    def _save_to_disk(self):
        """Lưu toàn bộ vector store vào ổ đĩa."""
        try:
            if not settings.DATA_DIR.exists():
                settings.DATA_DIR.mkdir(parents=True, exist_ok=True)
            with open(self.store_path, "w", encoding="utf-8") as f:
                json.dump({
                    "documents": self.documents,
                    "chunks": self.chunks,
                    "updatedAt": datetime.now().isoformat()
                }, f, ensure_ascii=False, indent=2)
        except Exception as e:
            logger.error(f"Failed to save vector store to disk: {e}")

    def add_document(
        self,
        title: str,
        content: str,
        category: str = "GENERAL",
        file_name: Optional[str] = None,
        file_type: str = "text",
        uploaded_by: Optional[str] = None
    ) -> Dict[str, Any]:
        """Chia nhỏ tài liệu, tạo vector embedding cho từng đoạn và lưu trữ vào Vector Store."""
        doc_id = str(uuid.uuid4())
        created_at = datetime.now().isoformat()
        
        chunk_texts = chunking_service.split_text(content)
        new_chunks = []

        for idx, chunk_text in enumerate(chunk_texts):
            chunk_id = str(uuid.uuid4())
            emb = embedding_service.get_embedding(chunk_text)
            chunk_obj = {
                "id": chunk_id,
                "documentId": doc_id,
                "chunkIndex": idx + 1,
                "content": chunk_text,
                "embedding": emb,
                "metadata": {
                    "documentTitle": title,
                    "category": category,
                    "fileName": file_name,
                }
            }
            new_chunks.append(chunk_obj)

        self.documents[doc_id] = {
            "id": doc_id,
            "title": title,
            "category": category,
            "fileName": file_name,
            "fileType": file_type,
            "fileSize": len(content),
            "chunksCount": len(new_chunks),
            "uploadedBy": uploaded_by,
            "createdAt": created_at
        }

        self.chunks.extend(new_chunks)
        self._save_to_disk()
        
        logger.info(f"Successfully added document '{title}' with {len(new_chunks)} vector chunks.")
        return {
            "documentId": doc_id,
            "title": title,
            "chunksCount": len(new_chunks)
        }

    def delete_document(self, doc_id: str) -> bool:
        """Xóa tài liệu và các vector chunks liên quan."""
        if doc_id not in self.documents:
            return False
        
        del self.documents[doc_id]
        self.chunks = [c for c in self.chunks if c.get("documentId") != doc_id]
        self._save_to_disk()
        return True

    def get_all_documents(self) -> List[Dict[str, Any]]:
        """Lấy danh sách tất cả cẩm nang."""
        return list(self.documents.values())

    def get_document_by_id(self, doc_id: str) -> Optional[Dict[str, Any]]:
        return self.documents.get(doc_id)

    def similarity_search(self, query: str, top_k: int = 3, min_score: float = 0.15) -> List[Dict[str, Any]]:
        """Tìm kiếm Top-K chunks có ngữ nghĩa tương đồng nhất với câu hỏi."""
        if not self.chunks or not query.strip():
            return []

        query_emb = embedding_service.get_embedding(query)
        scored_matches = []

        for chunk in self.chunks:
            chunk_emb = chunk.get("embedding")
            if not chunk_emb:
                continue

            score = embedding_service.cosine_similarity(query_emb, chunk_emb)
            if score >= min_score:
                doc_title = chunk.get("metadata", {}).get("documentTitle", "Tài liệu kỹ thuật")
                category = chunk.get("metadata", {}).get("category", "GENERAL")
                scored_matches.append({
                    "documentId": chunk.get("documentId"),
                    "documentTitle": doc_title,
                    "category": category,
                    "chunkIndex": chunk.get("chunkIndex", 1),
                    "content": chunk.get("content", ""),
                    "score": round(score, 3)
                })

        # Sắp xếp theo độ tương quan giảm dần
        scored_matches.sort(key=lambda x: x["score"], reverse=True)
        return scored_matches[:top_k]

vector_store = VectorStoreService()
