"""
Tests for Merit Engine config-driven scoring.
"""

from app.schemas.scheme_config import MeritCriterion, PreferenceRule
from app.services.merit_engine import compute_merit_score


def test_compute_merit_score_basic():
    criteria = [
        MeritCriterion(
            field="marks_percentage",
            name="Academic Marks",
            max_score=100.0,
            weight=60.0,
        ),
        MeritCriterion(
            field="family_income",
            name="Income Score",
            max_score=250000.0,
            weight=40.0,
        ),
    ]

    preference_rules = [
        PreferenceRule(
            rule_id="PR-PVTG",
            name="PVTG Bonus",
            field="is_pvtg",
            condition={"==": [{"var": "is_pvtg"}, True]},
            bonus_points=5.0,
            description="Bonus points for PVTG candidates",
        )
    ]

    applicant_data = {
        "marks_percentage": 80.0,
        "family_income": 125000.0,
        "is_pvtg": True,
    }

    result = compute_merit_score(applicant_data, criteria, preference_rules)

    assert result["total_score"] > 0
    assert result["bonus_score"] == 5.0
    assert "marks_percentage" in result["score_breakdown"]
    assert result["score_breakdown"]["marks_percentage"]["weighted_score"] == 48.0


def test_compute_merit_score_no_criteria():
    result = compute_merit_score({}, [], [])
    assert result["total_score"] == 0.0
    assert "notes" in result
