"""
Scholarship Admin Platform — FastAPI Application Entry Point

Provides:
  - CORS middleware (frontend origin from env)
  - GET /health endpoint that pings the database
  - MinIO bucket initialization on startup
"""

from contextlib import asynccontextmanager
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy import text

from app.core.config import get_settings
from app.core.database import engine
from app.services.storage_service import StorageService

settings = get_settings()


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Application lifespan events."""
    # Startup: ensure MinIO bucket exists
    storage_service = StorageService()
    try:
        storage_service.ensure_bucket_exists()
    except Exception as e:
        # Log error but don't crash - storage might not be ready yet
        import logging
        logging.getLogger(__name__).warning(f"MinIO bucket initialization failed: {e}")
    yield
    # Shutdown: nothing special needed


app = FastAPI(
    title=settings.APP_NAME,
    docs_url="/docs",
    redoc_url="/redoc",
    lifespan=lifespan,
)

from fastapi.middleware.gzip import GZipMiddleware
from app.core.cache import cache

app.add_middleware(GZipMiddleware, minimum_size=1000)

# ---------------------------------------------------------------------------
# CORS
# ---------------------------------------------------------------------------
app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        settings.FRONTEND_ORIGIN,
        "http://localhost:3000",
        "http://127.0.0.1:3000",
        "http://localhost:3001",
    ],
    allow_origin_regex=r"http://(localhost|127\.0\.0\.1)(:[0-9]+)?",
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# ---------------------------------------------------------------------------
# API Routers
# ---------------------------------------------------------------------------
from app.api import api_router

app.include_router(api_router)
# ---------------------------------------------------------------------------
@app.get("/health")
def health_check():
    """Return service health and database connectivity status."""
    cached_health = cache.get("health_check")
    if cached_health:
        return cached_health

    db_status = "not connected"
    try:
        with engine.connect() as conn:
            conn.execute(text("SELECT 1"))
            db_status = "connected"
    except Exception:
        db_status = "not connected"

    res = {"status": "ok", "db": db_status}
    cache.set("health_check", res, ttl=5)
    return res
