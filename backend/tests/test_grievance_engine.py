"""
Tests for Grievance Redressal and SLA Engine.
"""

from datetime import datetime, timedelta, timezone
from app.services.grievance_engine import (
    calculate_sla_due_date,
    check_sla_status,
)


def test_calculate_sla_due_date_default():
    start_time = datetime(2026, 9, 26, 10, 0, 0, tzinfo=timezone.utc)
    due_date = calculate_sla_due_date(priority="MEDIUM", start_time=start_time)
    assert due_date == start_time + timedelta(days=7)


def test_calculate_sla_due_date_high_priority():
    start_time = datetime(2026, 9, 26, 10, 0, 0, tzinfo=timezone.utc)
    due_date = calculate_sla_due_date(priority="HIGH", start_time=start_time)
    assert due_date == start_time + timedelta(days=3)


def test_calculate_sla_due_date_urgent_priority():
    start_time = datetime(2026, 9, 26, 10, 0, 0, tzinfo=timezone.utc)
    due_date = calculate_sla_due_date(priority="URGENT", start_time=start_time)
    assert due_date == start_time + timedelta(hours=24)


def test_check_sla_status_within_sla():
    created_at = datetime.now(timezone.utc) - timedelta(days=1)
    due_at = datetime.now(timezone.utc) + timedelta(days=2)
    status_info = check_sla_status(created_at, due_at, is_resolved=False)
    assert status_info["is_breached"] is False
    assert status_info["status"] == "ON_TIME"


def test_check_sla_status_breached():
    created_at = datetime.now(timezone.utc) - timedelta(days=5)
    due_at = datetime.now(timezone.utc) - timedelta(days=1)
    status_info = check_sla_status(created_at, due_at, is_resolved=False)
    assert status_info["is_breached"] is True
    assert status_info["status"] == "SLA_BREACHED"


def test_check_sla_status_resolved():
    created_at = datetime.now(timezone.utc) - timedelta(days=5)
    due_at = datetime.now(timezone.utc) - timedelta(days=1)
    status_info = check_sla_status(created_at, due_at, is_resolved=True)
    assert status_info["status"] == "RESOLVED"
