"""
Tests for Cross-Scheme Conflict and Duplicate Detection Engine.
"""

import pytest
from app.services.conflict_engine import (
    ConflictSignal,
    ConflictResult,
    calculate_identity_similarity,
)


def test_calculate_identity_similarity_exact_match():
    details = calculate_identity_similarity(
        app1_data={
            "aadhaar_hash": "hash_12345",
            "bank_account_hash": "bank_abc",
            "student_name": "Birsa Munda",
            "dob": "2002-05-12",
            "father_name": "Sugana Munda",
            "institute_id": "INST-001",
        },
        app2_data={
            "aadhaar_hash": "hash_12345",
            "bank_account_hash": "bank_abc",
            "student_name": "Birsa Munda",
            "dob": "2002-05-12",
            "father_name": "Sugana Munda",
            "institute_id": "INST-001",
        },
    )

    assert details["confidence_score"] >= 0.9
    assert details["same_aadhaar"] is True
    assert details["same_bank_account"] is True


def test_calculate_identity_similarity_partial_match():
    details = calculate_identity_similarity(
        app1_data={
            "aadhaar_hash": "hash_99999",
            "bank_account_hash": "bank_xyz",
            "student_name": "Rani Durgavati",
            "dob": "2001-11-20",
            "father_name": "Dalpat Shah",
            "institute_id": "INST-002",
        },
        app2_data={
            "aadhaar_hash": "hash_88888",
            "bank_account_hash": "bank_xyz",  # Same bank account
            "student_name": "Rani Durgavati",
            "dob": "2001-11-20",
            "father_name": "Dalpat Shah",
            "institute_id": "INST-002",
        },
    )

    assert details["confidence_score"] > 0.5
    assert details["same_bank_account"] is True
    assert details["same_aadhaar"] is False


def test_calculate_identity_similarity_no_match():
    details = calculate_identity_similarity(
        app1_data={
            "aadhaar_hash": "hash_111",
            "bank_account_hash": "bank_111",
            "student_name": "Person One",
            "dob": "2000-01-01",
            "father_name": "Father One",
            "institute_id": "INST-001",
        },
        app2_data={
            "aadhaar_hash": "hash_222",
            "bank_account_hash": "bank_222",
            "student_name": "Person Two",
            "dob": "1999-12-31",
            "father_name": "Father Two",
            "institute_id": "INST-002",
        },
    )

    assert details["confidence_score"] < 0.3
    assert details["same_aadhaar"] is False
    assert details["same_bank_account"] is False
