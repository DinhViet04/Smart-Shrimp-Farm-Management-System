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

class WeatherContext(BaseModel):
    cityName: Optional[str] = None
    temperature: Optional[float] = None
    feelsLike: Optional[float] = None
    humidity: Optional[int] = None
    description: Optional[str] = None
    windSpeed: Optional[float] = None
    rain1h: Optional[float] = None
    cloudiness: Optional[int] = None
    pressure: Optional[int] = None
    isRaining: Optional[bool] = False
    isHot: Optional[bool] = False
    isCold: Optional[bool] = False
    isWindy: Optional[bool] = False
    provider: Optional[str] = None
    recordedAt: Optional[str] = None

class PondRealtimeContext(BaseModel):
    pondId: Optional[str] = None
    pondName: Optional[str] = None
    farmName: Optional[str] = None
    farmLocation: Optional[str] = None
    areaSize: Optional[float] = None
    depth: Optional[float] = None
    waterVolume: Optional[float] = None       # m³ = areaSize × depth (tính sẵn ở backend)
    shrimpDensity: Optional[float] = None     # con/m² (tính sẵn ở backend)
    doc: Optional[int] = None
    initialShrimpCount: Optional[int] = None
    stage: Optional[str] = None
    latestWaterQuality: Optional[LatestWaterQuality] = None
    weather: Optional[WeatherContext] = None
    inventory: Optional[List[Dict[str, Any]]] = None

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
    sourceType: Optional[str] = "LOCAL_DOCUMENT" # "LOCAL_DOCUMENT" | "OPENAI_KNOWLEDGE" | "HYBRID"
    hasLocalKnowledge: Optional[bool] = False
    weather: Optional[WeatherContext] = None
    executionTimeSeconds: float = 0.0
