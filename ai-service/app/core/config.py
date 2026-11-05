import os
from typing import List
from pydantic_settings import BaseSettings
from pathlib import Path

# Base dir
BASE_DIR = Path(__file__).resolve().parent.parent.parent

class Settings(BaseSettings):
    PROJECT_NAME: str = "Smart Shrimp Farm AI Service"
    VERSION: str = "1.0.0"
    API_V1_STR: str = "/api/v1"
    
    # Server configuration
    HOST: str = "0.0.0.0"
    PORT: int = 8000
    
    # OpenAI
    OPENAI_API_KEY: str = ""
    OPENAI_CHAT_MODEL: str = "gpt-4o-mini"
    OPENAI_EMBEDDING_MODEL: str = "text-embedding-3-small"
    
    # Vector store & data directories
    DATA_DIR: Path = BASE_DIR / "data"
    VECTOR_STORE_PATH: Path = BASE_DIR / "data" / "vector_store.json"
    
    # Google Drive Ingestion
    GOOGLE_DRIVE_FOLDER_ID: str = ""
    GOOGLE_DRIVE_SERVICE_ACCOUNT_FILE: str = "service_account.json"
    GOOGLE_DRIVE_SERVICE_ACCOUNT_JSON: str = ""
    GOOGLE_DRIVE_API_KEY: str = ""
    AUTO_SYNC_DRIVE_ON_STARTUP: bool = False
    
    # CORS
    CORS_ORIGINS: List[str] = [
        "http://localhost:5173",
        "http://127.0.0.1:5173",
        "http://localhost:3000",
        "http://127.0.0.1:3000",
        "http://localhost:8081"
    ]
    
    class Config:
        env_file = ".env"
        extra = "ignore"

settings = Settings()
