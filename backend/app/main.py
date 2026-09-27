"""
Yojana Setu — FastAPI Application Entry Point

AI-enabled Scholarship & Fellowship Management System for Scheduled Tribes.
SIH Problem Statement: SIH26239 | Ministry of Tribal Affairs

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
# Security Headers Middleware
# ---------------------------------------------------------------------------
from starlette.middleware.base import BaseHTTPMiddleware
from starlette.requests import Request
from starlette.responses import Response

class SecurityHeadersMiddleware(BaseHTTPMiddleware):
    async def dispatch(self, request: Request, call_next):
        response: Response = await call_next(request)
        response.headers["X-Content-Type-Options"] = "nosniff"
        response.headers["X-XSS-Protection"] = "1; mode=block"
        response.headers["Referrer-Policy"] = "strict-origin-when-cross-origin"

        # If this is a document file/preview stream, allow framing by our dashboard & frontend
        path = request.url.path.lower()
        if "/file" in path or "/preview" in path:
            response.headers["X-Frame-Options"] = "SAMEORIGIN"
            response.headers["Content-Security-Policy"] = (
                f"frame-ancestors 'self' {settings.FRONTEND_ORIGIN} https://*.vercel.app http://localhost:3000 http://127.0.0.1:3000 http://localhost:8000;"
            )
        else:
            response.headers["X-Frame-Options"] = "DENY"
            response.headers["Content-Security-Policy"] = "frame-ancestors 'none';"
        return response

app.add_middleware(SecurityHeadersMiddleware)

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
    allow_origin_regex=r"https?://.*(vercel\.app|localhost|127\.0\.0\.1)(:[0-9]+)?",
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
