"""
Unit and integration tests for Government Integration Gateway (DigiLocker, API Setu, PFMS, DBT Bharat).
"""

import pytest
from app.services.integration_gateway import (
    get_verification_gateway,
    DigiLockerSandboxAdapter,
    APISetuSandboxAdapter,
    PFMSSandboxAdapter,
    DBTSandboxAdapter,
)


def test_gateway_system_status():
    gateway = get_verification_gateway()
    status = gateway.get_system_status()
    assert status["gateway_status"] == "ONLINE (SANDBOX_MODE)"
    assert "sandbox" in status["disclaimer"].lower()
    assert len(status["adapters"]) == 4
    names = [a["name"] for a in status["adapters"]]
    assert "DigiLocker" in names
    assert "PFMS" in names


def test_digilocker_valid_caste_certificate():
    adapter = DigiLockerSandboxAdapter()
    res = adapter.verify_certificate(
        document_type="caste_certificate",
        certificate_number="JH-ST-2024-001928",
        applicant_name="Birsa Munda",
        state="Jharkhand",
    )
    assert res.is_sandbox is True
    assert res.status == "VERIFIED"
    assert res.confidence >= 0.95
    assert res.fields["verified_category"] == "ST"
    assert "DigiLocker" in res.source


def test_digilocker_fake_certificate_detection():
    adapter = DigiLockerSandboxAdapter()
    res = adapter.verify_certificate(
        document_type="caste_certificate",
        certificate_number="FAKE-CERT-9999",
        applicant_name="Unknown Person",
        state="Jharkhand",
    )
    assert res.status == "NOT_FOUND"
    assert res.confidence == 0.0
    assert len(res.warnings) > 0


def test_apisetu_certificate_verification():
    adapter = APISetuSandboxAdapter()
    res = adapter.verify_certificate(
        document_type="income_certificate",
        certificate_number="INC-2024-88392",
        applicant_name="Sunita Oraon",
        state="Jharkhand",
    )
    assert res.status == "VERIFIED"
    assert res.is_sandbox is True
    assert "APISetu" in res.source
    assert res.fields["verification_status"] == "ACTIVE_AND_AUTHENTIC"


def test_pfms_bank_account_verification():
    adapter = PFMSSandboxAdapter()
    res = adapter.verify_bank_account(
        account_number="309182749102",
        ifsc_code="SBIN0001234",
        beneficiary_name="Birsa Munda",
    )
    assert res["status"] == "ACTIVE_BENEFICIARY_VALIDATED"
    assert res["is_sandbox"] is True
    assert res["masked_account"] == "XXXXXXXX9102"
    assert res["bank_name"] == "State Bank of India"
    assert res["dbt_ready"] is True


def test_pfms_invalid_ifsc_rejection():
    adapter = PFMSSandboxAdapter()
    res = adapter.verify_bank_account(
        account_number="309182749102",
        ifsc_code="INVALID_IFSC",
        beneficiary_name="Birsa Munda",
    )
    assert res["status"] == "FAILED"
    assert res["reason"] == "INVALID_IFSC_FORMAT"


def test_dbt_seeding_check():
    adapter = DBTSandboxAdapter()
    res = adapter.verify_dbt_seeding(
        aadhaar_last_four="4321",
        beneficiary_name="Birsa Munda",
    )
    assert res["masked_aadhaar"] == "XXXXXXXX4321"
    assert res["npci_mapper_status"] == "SEEDED_AND_ACTIVE"
    assert res["dbt_mandate_active"] is True


def test_combined_gateway_financial_verification():
    gateway = get_verification_gateway()
    fin_status = gateway.verify_financial_account(
        account_number="123456789012",
        ifsc_code="BKID0004567",
        beneficiary_name="Arjun Soren",
        aadhaar_last_four="8899",
    )
    assert fin_status["is_fully_disbursement_ready"] is True
    assert fin_status["overall_status"] == "READY_FOR_PFMS_DISBURSEMENT"
    assert fin_status["pfms_validation"]["bank_name"] == "Bank of India"
