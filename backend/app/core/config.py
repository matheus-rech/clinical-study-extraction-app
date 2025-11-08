"""
Configuration Management for Clinical Study Extraction System

Environment-aware configuration with validation and type safety.
"""

import os
from typing import List, Optional
from dotenv import load_dotenv
from functools import lru_cache

# Load environment variables from .env file
load_dotenv()


class Settings:
    """Application settings with environment variable support"""

    # Application
    APP_NAME: str = "Clinical Study PDF Processor"
    APP_VERSION: str = "2.0.0"
    DEBUG: bool = os.getenv("DEBUG", "False").lower() in ("true", "1", "yes")
    ENVIRONMENT: str = os.getenv("ENVIRONMENT", "development")

    # Server
    HOST: str = os.getenv("HOST", "0.0.0.0")
    PORT: int = int(os.getenv("PORT", "8000"))

    # CORS
    CORS_ORIGINS: List[str] = [
        origin.strip()
        for origin in os.getenv(
            "CORS_ORIGINS",
            "http://localhost:3000,http://localhost:5173"
        ).split(",")
    ]

    # File Upload
    MAX_FILE_SIZE: int = int(os.getenv("MAX_FILE_SIZE", "50000000"))  # 50MB
    ALLOWED_EXTENSIONS: List[str] = [
        ext.strip()
        for ext in os.getenv("ALLOWED_EXTENSIONS", "pdf").split(",")
        if ext.strip()
    ]

    # OCR
    TESSERACT_CMD: Optional[str] = os.getenv("TESSERACT_CMD", None)

    # API Keys (optional)
    OPENAI_API_KEY: Optional[str] = os.getenv("OPENAI_API_KEY")
    GEMINI_API_KEY: Optional[str] = os.getenv("GEMINI_API_KEY")

    # Database (if needed in future)
    DATABASE_URL: Optional[str] = os.getenv("DATABASE_URL")

    # Logging
    LOG_LEVEL: str = os.getenv("LOG_LEVEL", "DEBUG" if DEBUG else "INFO")
    LOG_FORMAT: str = "%(asctime)s - %(name)s - %(levelname)s - %(message)s"

    # Thread Pool
    MAX_WORKERS: int = int(os.getenv("MAX_WORKERS", "4"))

    # Rate Limiting (if implementing)
    RATE_LIMIT_ENABLED: bool = os.getenv("RATE_LIMIT_ENABLED", "False").lower() in ("true", "1", "yes")
    RATE_LIMIT_PER_MINUTE: int = int(os.getenv("RATE_LIMIT_PER_MINUTE", "60"))

    # Security
    SECRET_KEY: str = os.getenv("SECRET_KEY", "your-secret-key-change-in-production")
    ALLOWED_HOSTS: List[str] = [
        host.strip()
        for host in os.getenv("ALLOWED_HOSTS", "*").split(",")
    ]

    @property
    def is_production(self) -> bool:
        """Check if running in production environment"""
        return self.ENVIRONMENT.lower() in ("production", "prod")

    @property
    def is_development(self) -> bool:
        """Check if running in development environment"""
        return self.ENVIRONMENT.lower() in ("development", "dev")

    def validate(self) -> None:
        """Validate critical settings"""
        if self.is_production:
            # Production validations
            if self.SECRET_KEY == "your-secret-key-change-in-production":
                raise ValueError("SECRET_KEY must be set in production!")

            if "*" in self.CORS_ORIGINS:
                raise ValueError("CORS_ORIGINS cannot be '*' in production!")

            if self.DEBUG:
                print("WARNING: DEBUG mode is enabled in production!")

    def __repr__(self) -> str:
        """String representation (hide sensitive data)"""
        return (
            f"Settings("
            f"environment={self.ENVIRONMENT}, "
            f"debug={self.DEBUG}, "
            f"host={self.HOST}, "
            f"port={self.PORT})"
        )


@lru_cache()
def get_settings() -> Settings:
    """
    Get cached settings instance

    Returns:
        Settings instance
    """
    settings = Settings()
    settings.validate()
    return settings


# Global settings instance
settings = get_settings()
