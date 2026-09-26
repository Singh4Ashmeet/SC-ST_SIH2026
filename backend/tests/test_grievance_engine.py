"""
Tests for Grievance SLA configuration.
"""

from app.models.grievance import GrievancePriority, GrievanceStatus
from app.api.grievances import SLA_DEFAULTS


def test_sla_defaults_by_priority():
    assert SLA_DEFAULTS[GrievancePriority.CRITICAL] == 8
    assert SLA_DEFAULTS[GrievancePriority.HIGH] == 24
    assert SLA_DEFAULTS[GrievancePriority.NORMAL] == 48
    assert SLA_DEFAULTS[GrievancePriority.LOW] == 72


def test_grievance_status_enum():
    statuses = [s.value for s in GrievanceStatus]
    assert "OPEN" in statuses
    assert "RESOLVED" in statuses
