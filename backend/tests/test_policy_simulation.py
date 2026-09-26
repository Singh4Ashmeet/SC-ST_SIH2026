"""
Tests for Policy Simulation Engine config validation and structure.
"""

from app.schemas.scheme_config import SchemeConfig, EligibilityRule
from app.services.scheme_config_validator import validate_scheme_config


def test_scheme_config_validation_for_simulation():
    raw_config = {
        "scheme_id": "SCH-TEST-01",
        "name": "Test Scholarship",
        "version": 1,
        "code": "TST-01",
        "description": "Test scheme description",
        "sponsor": "Ministry of Tribal Affairs",
        "funding_ratio": {"central": 100.0, "state": 0.0},
        "sanctioned_budget": 5000000.0,
        "sanctioned_slots": 50,
        "disbursement_amount": 20000.0,
        "eligibility_rules": [
            {
                "rule_id": "R1",
                "field": "annual_income",
                "condition": {"<=": 250000.0},
                "failure_message": "Income exceeds 2.5L",
            }
        ],
        "required_documents": [],
        "workflow_states": [
            {"name": "submitted", "label": "Submitted"},
            {"name": "approved", "label": "Approved", "is_terminal": True},
        ],
        "workflow_transitions": [
            {
                "trigger": "approve",
                "from_state": "submitted",
                "to_state": "approved",
                "allowed_roles": ["SCHEME_ADMIN"],
            }
        ],
    }

    validated_config = validate_scheme_config(raw_config)
    assert validated_config.code == "TST-01"
    assert len(validated_config.eligibility_rules) == 1
