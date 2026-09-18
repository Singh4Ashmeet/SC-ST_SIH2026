"""
Tests for SchemeConfig validation, integrity rules, fixtures, and the validation API endpoint.
"""

import json
from pathlib import Path
import pytest
from fastapi.testclient import TestClient

from app.main import app
from app.services.scheme_config_validator import validate_scheme_config
from app.schemas.scheme_config import SchemeConfigValidationError

FIXTURES_DIR = Path(__file__).resolve().parent.parent / "app" / "fixtures"


def load_fixture(filename: str) -> dict:
    """Load JSON fixture from app/fixtures."""
    filepath = FIXTURES_DIR / filename
    with open(filepath, "r", encoding="utf-8") as f:
        return json.load(f)


def test_nfst_fixture_validation():
    """Verify that the NFST fixture config passes validation."""
    data = load_fixture("nfst_config.json")
    config = validate_scheme_config(data)
    assert config.scheme_code == "NFST"
    assert config.version == 1
    assert len(config.eligibility_rules) == 3
    assert len(config.required_documents) == 4
    assert len(config.workflow_states) == 8
    assert len(config.workflow_transitions) == 9
    assert config.initial_state == "submitted"


def test_nos_fixture_validation():
    """Verify that the NOS fixture config passes validation."""
    data = load_fixture("nos_config.json")
    config = validate_scheme_config(data)
    assert config.scheme_code == "NOS"
    assert config.version == 1
    assert len(config.eligibility_rules) == 3
    assert len(config.required_documents) == 4
    assert len(config.workflow_states) == 7
    assert config.initial_state == "submitted"


def test_broken_transition_nonexistent_state():
    """Verify that a transition referencing a non-existent state raises ValueError."""
    data = load_fixture("nfst_config.json")
    # Point a transition to a non-existent state
    data["workflow_transitions"].append({
        "from_state": "submitted",
        "to_state": "ghost_stage_xyz",
        "trigger": "magic_jump",
        "allowed_roles": []
    })

    with pytest.raises(ValueError) as exc_info:
        validate_scheme_config(data)

    error_msg = str(exc_info.value)
    assert "ghost_stage_xyz" in error_msg
    assert "does not exist in workflow_states" in error_msg


def test_collects_all_errors():
    """Verify that multiple validation errors are all collected, not stopping at first."""
    data = load_fixture("nfst_config.json")

    # 1. Invalid initial state
    data["initial_state"] = "unknown_initial"

    # 2. Transition from unknown state
    data["workflow_transitions"].append({
        "from_state": "nonexistent_source",
        "to_state": "submitted",
        "trigger": "bad_trigger",
        "allowed_roles": []
    })

    # 3. Duplicate doc_types
    data["required_documents"].append({
        "doc_type": "income_certificate",  # already exists
        "label": "Duplicate Income Certificate",
        "required": True,
        "accepted_formats": ["pdf"]
    })

    with pytest.raises(ValueError) as exc_info:
        validate_scheme_config(data)

    err_text = str(exc_info.value)
    assert "unknown_initial" in err_text
    assert "nonexistent_source" in err_text
    assert "income_certificate" in err_text


def test_unreachable_terminal_state():
    """Verify that when no terminal state is reachable, validation fails."""
    data = {
        "scheme_code": "TEST_CYCLE",
        "version": 1,
        "eligibility_rules": [],
        "required_documents": [
            {"doc_type": "doc_a", "label": "Doc A", "required": True, "accepted_formats": ["pdf"]}
        ],
        "workflow_states": [
            {"name": "state_1", "label": "State 1", "is_terminal": False},
            {"name": "state_2", "label": "State 2", "is_terminal": False},
            {"name": "terminal_end", "label": "Terminal End", "is_terminal": True}
        ],
        # Only transitions between state_1 and state_2, terminal_end is disconnected
        "workflow_transitions": [
            {"from_state": "state_1", "to_state": "state_2", "trigger": "next", "allowed_roles": []},
            {"from_state": "state_2", "to_state": "state_1", "trigger": "loop", "allowed_roles": []}
        ],
        "initial_state": "state_1"
    }

    with pytest.raises(ValueError) as exc_info:
        validate_scheme_config(data)

    assert "No terminal state is reachable" in str(exc_info.value)


def test_validate_config_api_endpoint_success(super_admin_client):
    """Test POST /api/schemes/validate-config returns 200 with valid=True for valid configs."""
    # Test NFST
    nfst_data = load_fixture("nfst_config.json")
    res_nfst = super_admin_client.post("/api/schemes/validate-config", json=nfst_data)
    assert res_nfst.status_code == 200
    body_nfst = res_nfst.json()
    assert body_nfst["valid"] is True
    assert body_nfst["config"]["scheme_code"] == "NFST"

    # Test NOS
    nos_data = load_fixture("nos_config.json")
    res_nos = super_admin_client.post("/api/schemes/validate-config", json=nos_data)
    assert res_nos.status_code == 200
    body_nos = res_nos.json()
    assert body_nos["valid"] is True
    assert body_nos["config"]["scheme_code"] == "NOS"


def test_validate_config_api_endpoint_failure(super_admin_client):
    """Test POST /api/schemes/validate-config returns 200 with valid=False and errors list."""
    broken_data = {
        "scheme_code": "BROKEN",
        "initial_state": "nonexistent_start",
        "workflow_states": [
            {"name": "step_one", "label": "Step 1", "is_terminal": False}
        ],
        "workflow_transitions": [
            {"from_state": "step_one", "to_state": "nowhere", "trigger": "fail", "allowed_roles": []}
        ],
        "required_documents": []
    }

    res = super_admin_client.post("/api/schemes/validate-config", json=broken_data)
    assert res.status_code == 200
    body = res.json()
    assert body["valid"] is False
    assert isinstance(body["errors"], list)
    assert len(body["errors"]) > 0
    errors_str = " ".join(body["errors"])
    assert "nonexistent_start" in errors_str
    assert "nowhere" in errors_str


def test_validate_config_api_unauthorized(unauthenticated_client):
    """Test that unauthenticated requests to validate-config return 401."""
    nfst_data = load_fixture("nfst_config.json")
    res = unauthenticated_client.post("/api/schemes/validate-config", json=nfst_data)
    assert res.status_code == 401


def test_validate_config_api_forbidden(scheme_admin_client):
    """Test that SCHEME_ADMIN can access validate-config (allowed)."""
    nfst_data = load_fixture("nfst_config.json")
    res = scheme_admin_client.post("/api/schemes/validate-config", json=nfst_data)
    assert res.status_code == 200
