"""
Tests for Conflict Engine identity matching logic.
"""

from app.services.conflict_engine import _compute_match_confidence, _name_similarity


def test_name_similarity_exact():
    sim = _name_similarity("Birsa Munda", "Birsa Munda")
    assert sim == 1.0


def test_name_similarity_partial():
    sim = _name_similarity("Birsa Munda", "Birsa K. Munda")
    assert sim > 0.7


def test_compute_match_confidence_exact():
    app1_data = {"date_of_birth": "2001-05-10", "mobile": "9876543210"}
    app2_data = {"date_of_birth": "2001-05-10", "mobile": "9876543210"}
    matching_fields = ["applicant_name", "date_of_birth", "mobile", "applicant_email"]

    confidence, signals = _compute_match_confidence(
        app1_data=app1_data,
        app2_data=app2_data,
        app1_name="Birsa Munda",
        app2_name="Birsa Munda",
        app1_email="birsa@example.com",
        app2_email="birsa@example.com",
        matching_fields=matching_fields,
    )

    assert confidence >= 0.8
    assert signals.get("email_match") is True
