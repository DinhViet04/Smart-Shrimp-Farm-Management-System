from typing import List, Optional, Dict, Any
from pydantic import BaseModel, Field
from datetime import datetime

class KnowledgeChunkItem(BaseModel):
    id: str
    documentId: str
    chunkIndex: int
    content: str
    embedding: Optional[List[float]] = None
    metadata: Dict[str, Any] = {}

class KnowledgeDocumentCreate(BaseModel):
    title: str
    category: str = "GENERAL" # WATER_QUALITY | FEEDING | SHRIMP_DISEASE | 5T_PROCESS | GENERAL
    content: str
    fileName: Optional[str] = None
    fileType: Optional[str] = "text"
    uploadedBy: Optional[str] = None

class KnowledgeDocumentResponse(BaseModel):
    id: str
    title: str
    category: str
    fileName: Optional[str] = None
    fileType: Optional[str] = "text"
    fileSize: int = 0
    chunksCount: int = 0
    uploadedBy: Optional[str] = None
    createdAt: str

class DocumentUploadResponse(BaseModel):
    message: str
    documentId: str
    title: str
    chunksCount: int

class DriveSyncRequest(BaseModel):
    folderId: Optional[str] = None
    force: bool = False
    pruneDeleted: bool = False

class DriveStatusResponse(BaseModel):
    isConfigured: bool
    folderId: Optional[str] = None
    authMethod: str
    hasFolderId: bool
    credentialsFileFound: bool
    credentialsFilePath: Optional[str] = None
    lastSync: Optional[Dict[str, Any]] = None

