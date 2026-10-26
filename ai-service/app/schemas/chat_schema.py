from typing import List, Optional, Dict, Any
from pydantic import BaseModel, Field

class LatestWaterQuality(BaseModel):
    ph: Optional[float] = None
    dissolvedOxygen: Optional[float] = None
    salinity: Optional[float] = None
    temperature: Optional[float] = None
    nh3: Optional[float] = None
    no2: Optional[float] = None
    alkalinity: Optional[float] = None

class PondRealtimeContext(BaseModel):
    pondId: Optional[str] = None
    pondName: Optional[str] = None
    farmName: Optional[str] = None
    areaSize: Optional[float] = None
    depth: Optional[float] = None
    doc: Optional[int] = None
    initialShrimpCount: Optional[int] = None
    stage: Optional[str] = None
    latestWaterQuality: Optional[LatestWaterQuality] = None

class ChatMessage(BaseModel):
    role: str # "user" | "assistant" | "system"
    content: str

class AskChatRequest(BaseModel):
    question: str = Field(..., description="Câu hỏi kỹ thuật của người nuôi")
    pondId: Optional[str] = None
    pondContext: Optional[PondRealtimeContext] = None
    conversationHistory: Optional[List[ChatMessage]] = []

class CitationSource(BaseModel):
    documentTitle: str
    category: Optional[str] = None
    chunkIndex: int
    snippet: str
    relevanceScore: float

class AskChatResponse(BaseModel):
    answer: str
    sources: List[CitationSource] = []
    pondName: Optional[str] = None
    recommendations: List[str] = []
    executionTimeSeconds: float = 0.0
