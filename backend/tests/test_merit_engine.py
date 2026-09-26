"""
Tests for Merit Engine: composite score calculation, merit ranking, quota filtering, and list generation.
"""

import pytest
from app.services.merit_engine import (
    MeritCriteria,
    MeritApplicant,
    evaluate_applicant_merit,
    rank_applicants,
    generate_merit_list,
)


def test_merit_criteria_weight_validation():
    # Valid criteria sum to 100
    criteria = MeritCriteria(
        academic_weight=40.0,
        income_weight=30.0,
        category_weight=20.0,
        gender_weight=10.0,
        pvtg_bonus=5.0,
    )
    assert criteria.academic_weight + criteria.income_weight + criteria.category_weight + criteria.gender_weight == 100.0


def test_evaluate_applicant_merit():
    criteria = MeritCriteria(
        academic_weight=50.0,
        income_weight=30.0,
        category_weight=20.0,
        gender_weight=0.0,
        pvtg_bonus=10.0,
    )

    applicant = MeritApplicant(
        application_id="app-1",
        student_id="st-1",
        student_name="Arjun Munda",
        marks_percentage=85.0,
        annual_income=150000.0,  # Below 2.5L -> max income score
        st_category="PVTG",
        gender="Male",
        is_pvtg=True,
    )

    result = evaluate_applicant_merit(applicant, criteria)
    assert result.composite_score > 0
    assert result.breakdown["pvtg_bonus"] == 10.0
    assert result.breakdown["academic_score"] == 85.0 * 0.5


def test_rank_applicants_tie_breaking():
    criteria = MeritCriteria(
        academic_weight=50.0,
        income_weight=50.0,
        category_weight=0.0,
        gender_weight=0.0,
        pvtg_bonus=0.0,
    )

    # Two applicants with same composite score but different marks
    app1 = MeritApplicant(
        application_id="app-1",
        student_id="st-1",
        student_name="Applicant A",
        marks_percentage=90.0,
        annual_income=300000.0,
        st_category="ST",
        gender="Male",
    )

    app2 = MeritApplicant(
        application_id="app-2",
        student_id="st-2",
        student_name="Applicant B",
        marks_percentage=80.0,
        annual_income=100000.0,
        st_category="ST",
        gender="Male",
    )

    ranked = rank_applicants([app1, app2], criteria)
    assert len(ranked) == 2
    # Equal composite score check tie break by marks_percentage
    assert ranked[0].rank == 1


def test_generate_merit_list_with_sanctioned_slots():
    criteria = MeritCriteria(
        academic_weight=50.0,
        income_weight=50.0,
        category_weight=0.0,
        gender_weight=0.0,
        pvtg_bonus=0.0,
    )

    applicants = [
        MeritApplicant(
            application_id=f"app-{i}",
            student_id=f"st-{i}",
            student_name=f"Student {i}",
            marks_percentage=60.0 + i * 5,
            annual_income=200000.0,
            st_category="ST",
            gender="Female" if i % 2 == 0 else "Male",
        )
        for i in range(5)
    ]

    merit_list = generate_merit_list(
        applicants=applicants,
        criteria=criteria,
        total_sanctioned_slots=3,
        female_reservation_pct=30.0,
    )

    assert len(merit_list.ranked_applicants) == 5
    selected = [a for a in merit_list.ranked_applicants if a.status == "SELECTED"]
    waitlisted = [a for a in merit_list.ranked_applicants if a.status == "WAITLISTED"]
    assert len(selected) == 3
    assert len(waitlisted) == 2
