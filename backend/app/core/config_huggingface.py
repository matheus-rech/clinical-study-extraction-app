"""
Configuration for Hugging Face Spaces deployment
Simplified version without database dependencies
"""

import os
from typing import List
from pydantic_settings import BaseSettings


class Settings(BaseSettings):
    """Application settings for Hugging Face Spaces"""
    
    # Application
    APP_NAME: str = "Clinical Study Extraction API"
    VERSION: str = "1.0.0"
    ENVIRONMENT: str = os.getenv("ENVIRONMENT", "production")
    DEBUG: bool = os.getenv("DEBUG", "False").lower() == "true"
    
    # Server
    HOST: str = os.getenv("HOST", "0.0.0.0")
    PORT: int = int(os.getenv("PORT", "7860"))
    
    # CORS
    CORS_ORIGINS: List[str] = os.getenv("CORS_ORIGINS", "*").split(",")
    
    # File Upload
    MAX_FILE_SIZE: int = int(os.getenv("MAX_FILE_SIZE", "100000000"))  # 100MB
    UPLOAD_DIR: str = os.getenv("UPLOAD_DIR", "/home/user/app/uploads")
    EXPORT_DIR: str = os.getenv("EXPORT_DIR", "/home/user/app/exports")
    CACHE_DIR: str = os.getenv("CACHE_DIR", "/home/user/app/cache")
    
    # olmOCR Configuration
    OLMOCR_API_KEY: str = os.getenv("OLMOCR_API_KEY", "")
    OLMOCR_PROVIDER: str = os.getenv("OLMOCR_PROVIDER", "deepinfra")
    OLMOCR_ENABLED: bool = os.getenv("OLMOCR_ENABLED", "true").lower() == "true"
    
    # Optional AI Services
    GEMINI_API_KEY: str = os.getenv("GEMINI_API_KEY", "")
    ANTHROPIC_API_KEY: str = os.getenv("ANTHROPIC_API_KEY", "")
    
    # Logging
    LOG_LEVEL: str = os.getenv("LOG_LEVEL", "INFO")
    
    # Database (disabled for Hugging Face free tier)
    USE_DATABASE: bool = False
    
    class Config:
        case_sensitive = True
        env_file = ".env"
        env_file_encoding = "utf-8"


# Create settings instance
settings = Settings()


# Create directories if they don't exist
def ensure_directories():
    """Ensure required directories exist"""
    import os
    os.makedirs(settings.UPLOAD_DIR, exist_ok=True)
    os.makedirs(settings.EXPORT_DIR, exist_ok=True)
    os.makedirs(settings.CACHE_DIR, exist_ok=True)


# Call on import
ensure_directories()
