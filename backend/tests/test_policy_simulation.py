"""
Tests for Policy Simulation and Sandbox Engine.
"""

from app.schemas.scheme_config import SchemeConfig, EligibilityRule
from app.services.policy_simulation_engine import simulate_policy_change


def test_simulate_policy_change_income_cap_reduction():
    # Base config: Income <= 2,500,000 (25 Lakhs for test or 2.5 Lakhs)
    base_config = SchemeConfig(
        scheme_id="SCHEME-TEST-01",
        name="Post-Matric ST Scholarship",
        version=1,
        code="PMS-ST",
        description="Scholarship for ST students",
        sponsor="Ministry of Tribal Affairs",
        funding_ratio={"central": 75.0, "state": 25.0},
        sanctioned_budget=10000000.0,
        sanctioned_slots=100,
        disbursement_amount=50000.0,
        eligibility_rules=[
            EligibilityRule(
                rule_id="R1",
                field="annual_income",
                operator="<=",
                value=250000.0,
                failure_message="Income exceeds 2.5L",
            )
        ],
        document_requirements=[],
        workflows=[],
    )

    modified_config = base_config.model_copy(deep=True)
    modified_config.eligibility_rules = [
        EligibilityRule(
            rule_id="R1",
            field="annual_income",
            operator="<=",
            value=200000.0,  # Tighten income cap to 2 Lakhs
            failure_message="Income exceeds 2.0L",
        )
    ]

    applicant_pool = [
        {"id": "app1", "annual_income": 150000.0},
        {"id": "app2", "annual_income": 220000.0},  # Eligible in base, ineligible in modified
        {"id": "app3", "annual_income": 300000.0},  # Ineligible in both
    ]

    sim_result = simulate_policy_change(
        current_config=base_config,
        proposed_config=modified_config,
        applicant_pool=applicant_pool,
        disbursement_per_student=50000.0,
    )

    assert sim_result.current_eligible_count == 2
    assert sim_result.proposed_eligible_count == 1
    assert sim_result.eligible_count_delta == -1
    assert sim_result.net_budget_delta == -50000.0  # Savings of 50k
    assert sim_result.newly_ineligible_count == 1
