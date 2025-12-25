"""
Configuration settings for the Student AI Mentor
"""
from pydantic_settings import BaseSettings
from typing import List, Optional
import os
from functools import lru_cache


class Settings(BaseSettings):
    """Application settings loaded from environment variables"""
    
    # API Configuration
    GEMINI_API_KEY: str
    MODEL_NAME: str = "gemini-2.5-flash-lite"
    MODEL_TEMPERATURE: float = 0.7
    MAX_TOKENS: int = 1000
    
    # Server Configuration
    HOST: str = "0.0.0.0"
    PORT: int = 8000
    DEBUG: bool = False
    
    # RAG Configuration
    RAG_PERSIST_DIR: str = "./chroma_db"
    CHUNK_SIZE: int = 1000
    CHUNK_OVERLAP: int = 200
    SEARCH_RESULTS: int = 3
    
    # CORS Configuration - Accepts comma-separated string
    CORS_ORIGINS: str = "*"
    
    # File upload settings
    MAX_UPLOAD_SIZE: int = 10 * 1024 * 1024  # 10MB
    ALLOWED_EXTENSIONS: List[str] = [".pdf", ".txt", ".md"]
    
    # Conversation settings
    MAX_HISTORY_LENGTH: int = 50
    MAX_CONTEXT_MESSAGES: int = 10
    
    def get_cors_origins(self) -> List[str]:
        """Parse CORS_ORIGINS string into list"""
        if self.CORS_ORIGINS.strip() == "*":
            return ["*"]
        return [origin.strip() for origin in self.CORS_ORIGINS.split(",")]
    
    class Config:
        env_file = ".env"
        env_file_encoding = "utf-8"
        case_sensitive = False
        # Allow comma-separated strings for list-like fields
        @classmethod
        def parse_env_var(cls, field_name: str, raw_val: str):
            if field_name == "ALLOWED_EXTENSIONS":
                return [ext.strip() for ext in raw_val.split(",")]
            return raw_val


@lru_cache()
def get_settings() -> Settings:
    """Get cached settings instance"""
    try:
        return Settings()
    except Exception as e:
        print(f"⚠️ Warning: Could not load .env file: {e}")
        print("Using environment variables or defaults...")
        
        # Fallback to environment variables
        return Settings(
            GEMINI_API_KEY=os.getenv("GEMINI_API_KEY", ""),
            MODEL_NAME=os.getenv("MODEL_NAME", "gemini-2.5-flash-lite"),
            HOST=os.getenv("HOST", "0.0.0.0"),
            PORT=int(os.getenv("PORT", "8000")),
            CORS_ORIGINS=os.getenv("CORS_ORIGINS", "*")
        )


# Global settings instance
settings = get_settings()