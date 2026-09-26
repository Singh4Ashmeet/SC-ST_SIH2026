"""
Yojana Setu — Configuration & Settings

AI-enabled Scholarship & Fellowship Management System for Scheduled Tribes.
SIH Problem Statement: SIH26239 | Ministry of Tribal Affairs

Uses pydantic-settings to load configuration from environment variables / .env file.
"""

from pydantic_settings import BaseSettings
from functools import lru_cache


class Settings(BaseSettings):
    """Application settings loaded from environment variables."""

    # Application
    APP_NAME: str = "Yojana Setu"
    DEBUG: bool = False

    # Database
    # Default to local sqlite for secure offline development; override via DATABASE_URL environment variable
    DATABASE_URL: str = "sqlite:///./scholarship_dev.db"

    # CORS
    FRONTEND_ORIGIN: str = "http://localhost:3000"

    # JWT Authentication
    SECRET_KEY: str = "yojana-setu-secure-secret-key-motas-sih-2026-min-32-chars"
    JWT_ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 60
    REQUIRE_APPLICANT_AUTH: bool = False  # Set to True in production for strict applicant-auth enforcement

    # MinIO Object Storage
    MINIO_ENDPOINT: str = "http://localhost:9000"
    MINIO_ACCESS_KEY: str = "minioadmin"
    MINIO_SECRET_KEY: str = "minioadmin"
    MINIO_BUCKET_NAME: str = "scholarship-docs"

    # AI & Integration Providers (Honest decoupled abstractions)
    OCR_PROVIDER: str = "tesseract"
    EMAIL_PROVIDER: str = "sandbox"
    SMS_PROVIDER: str = "sandbox"
    DIGILOCKER_BASE_URL: str = "https://sandbox.digitallocker.gov.in"
    API_SETU_BASE_URL: str = "https://sandbox.apisetu.gov.in"
    PFMS_BASE_URL: str = "https://sandbox.pfms.gov.in"

    # Uncertainty Routing Thresholds
    CONFIDENCE_THRESHOLD_AUTO_VERIFY: float = 0.90
    CONFIDENCE_THRESHOLD_REVIEW_RECOMMENDED: float = 0.70

    model_config = {
        "env_file": ".env",
        "env_file_encoding": "utf-8",
        "case_sensitive": True,
        "extra": "ignore",
    }


@lru_cache()
def get_settings() -> Settings:
    """Return cached settings instance."""
    return Settings()
