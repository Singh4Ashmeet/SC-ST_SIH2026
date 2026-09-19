"""
API router configuration and endpoint aggregation.
"""

from fastapi import APIRouter

from app.api.auth import router as auth_router
from app.api.schemes import router as schemes_router
from app.api.applications import router as applications_router
from app.api.documents import router as documents_router
from app.api.scrutiny import router as scrutiny_router
from app.api.audit_log import router as audit_log_router
from app.api.disbursements import router as disbursements_router
from app.api.disbursements_crud import router as disbursements_crud_router
from app.api.renewals import router as renewals_router
from app.api.renewals_crud import router as renewals_crud_router
from app.api.post_selection import router as post_selection_router
from app.api.stats import router as stats_router

api_router = APIRouter(prefix="/api")
api_router.include_router(auth_router)
api_router.include_router(schemes_router)
api_router.include_router(applications_router)
api_router.include_router(documents_router)
api_router.include_router(scrutiny_router)
api_router.include_router(audit_log_router)
api_router.include_router(disbursements_router)
api_router.include_router(disbursements_crud_router)
api_router.include_router(renewals_router)
api_router.include_router(renewals_crud_router)
api_router.include_router(post_selection_router)
api_router.include_router(stats_router)

__all__ = ["api_router"]
