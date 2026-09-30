from fastapi import APIRouter, HTTPException, UploadFile, File, Form
from typing import List, Optional
from app.schemas.document_schema import (
    KnowledgeDocumentCreate, 
    KnowledgeDocumentResponse, 
    DocumentUploadResponse
)
from app.services.vector_store import vector_store
from app.services.chunking_service import chunking_service
from app.core.logging import logger

router = APIRouter()

@router.get("", response_model=List[KnowledgeDocumentResponse])
def get_documents():
    """Lấy danh sách tất cả tài liệu cẩm nang trong Vector Store."""
    docs = vector_store.get_all_documents()
    return docs

@router.post("/text", response_model=DocumentUploadResponse)
def create_text_document(doc_in: KnowledgeDocumentCreate):
    """Nạp cẩm nang từ văn bản trực tiếp."""
    try:
        result = vector_store.add_document(
            title=doc_in.title,
            content=doc_in.content,
            category=doc_in.category,
            file_name=doc_in.fileName,
            file_type=doc_in.fileType or "text",
            uploaded_by=doc_in.uploadedBy
        )
        return DocumentUploadResponse(
            message="Nạp tài liệu và trích xuất vector chunks thành công!",
            documentId=result["documentId"],
            title=result["title"],
            chunksCount=result["chunksCount"]
        )
    except Exception as e:
        logger.error(f"Error creating text document: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@router.post("/upload", response_model=DocumentUploadResponse)
async def upload_document_file(
    file: UploadFile = File(...),
    title: Optional[str] = Form(None),
    category: str = Form("GENERAL"),
    uploadedBy: Optional[str] = Form(None)
):
    """Nạp tài liệu từ file tải lên (PDF, TXT, Markdown)."""
    try:
        file_bytes = await file.read()
        file_name = file.filename or "unknown"
        doc_title = title.strip() if title else file_name

        # Đọc nội dung file
        if file_name.lower().endswith(".pdf"):
            content = chunking_service.extract_text_from_pdf(file_bytes)
            file_type = "pdf"
        else:
            content = file_bytes.decode("utf-8", errors="ignore")
            file_type = "text"

        if not content.strip():
            raise HTTPException(status_code=400, detail="Không tìm thấy nội dung văn bản hợp lệ trong file.")

        result = vector_store.add_document(
            title=doc_title,
            content=content,
            category=category,
            file_name=file_name,
            file_type=file_type,
            uploaded_by=uploadedBy
        )

        return DocumentUploadResponse(
            message=f"Đã trích xuất {result['chunksCount']} đoạn vector từ file {file_name}!",
            documentId=result["documentId"],
            title=result["title"],
            chunksCount=result["chunksCount"]
        )
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error processing uploaded file: {e}")
        raise HTTPException(status_code=500, detail=f"Lỗi khi xử lý file: {str(e)}")

@router.delete("/{doc_id}")
def delete_document(doc_id: str):
    """Xóa tài liệu và các vector chunks liên quan."""
    success = vector_store.delete_document(doc_id)
    if not success:
        raise HTTPException(status_code=404, detail="Không tìm thấy tài liệu cần xóa.")
    return {"message": "Đã xóa tài liệu và dữ liệu vector chunks liên quan."}
