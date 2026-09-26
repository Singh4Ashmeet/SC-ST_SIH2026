"""
API Endpoints for Government Integration Gateway.

Provides explicit Sandbox/Mock verification routes for DigiLocker, API Setu,
PFMS, and DBT Bharat to demonstrate interoperability during SIH evaluation.
"""

from typing import Any, Dict, Optional
from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel, Field

from app.core.deps import get_current_user
from app.core.permissions import Permission
from app.models.user import User
from app.services.integration_gateway import get_verification_gateway

router = APIRouter(prefix="/integrations", tags=["Government Integrations"])


class CertificateVerificationRequest(BaseModel):
    document_type: str = Field(..., example="caste_certificate")
    certificate_number: str = Field(..., example="JH-ST-2024-88392")
    applicant_name: str = Field(..., example="Birsa Munda")
    state: Optional[str] = Field("Jharkhand", example="Jharkhand")
    provider: Optional[str] = Field("digilocker", example="digilocker")


class BankVerificationRequest(BaseModel):
    account_number: str = Field(..., example="308192847192")
    ifsc_code: str = Field(..., example="SBIN0001234")
    beneficiary_name: str = Field(..., example="Birsa Munda")
    aadhaar_last_four: Optional[str] = Field("1029", example="1029")


@router.get("/status")
def get_gateway_status():
    """
    Returns operational status of all external government verification gateways.
    Publicly exposes sandbox transparency disclaimers.
    """
    gateway = get_verification_gateway()
    return gateway.get_system_status()


@router.post("/verify-certificate")
def verify_certificate(
    req: CertificateVerificationRequest,
    current_user: User = Depends(get_current_user),
):
    """
    Verifies a certificate (Caste, Income, Academic) via DigiLocker or API Setu Sandbox.
    """
    gateway = get_verification_gateway()
    result = gateway.verify_document_external(
        document_type=req.document_type,
        certificate_number=req.certificate_number,
        applicant_name=req.applicant_name,
        state=req.state,
        preferred_provider=req.provider or "digilocker",
    )
    return result.to_dict()


@router.post("/verify-bank")
def verify_bank_account(
    req: BankVerificationRequest,
    current_user: User = Depends(get_current_user),
):
    """
    Verifies Bank Account IFSC, beneficiary name match, and DBT Aadhaar-link
    readiness via PFMS and NPCI Sandbox adapters.
    """
    gateway = get_verification_gateway()
    result = gateway.verify_financial_account(
        account_number=req.account_number,
        ifsc_code=req.ifsc_code,
        beneficiary_name=req.beneficiary_name,
        aadhaar_last_four=req.aadhaar_last_four,
    )
    return result
