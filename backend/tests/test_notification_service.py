"""
Tests for NotificationService.
"""

import logging
from unittest.mock import patch
import uuid
import pytest

from app.models.application import Application
from app.services.notification_service import (
    NotificationEvent,
    NotificationService,
    notification_service,
)


class DummyApplication:
    """Mock Application object for notification testing."""
    def __init__(self, id, applicant_name, applicant_email):
        self.id = id
        self.applicant_name = applicant_name
        self.applicant_email = applicant_email


def test_notify_logs_structured_message(caplog):
    """notify() logs the expected structured message with application details at INFO level."""
    caplog.set_level(logging.INFO, logger="app.notifications")

    app_id = uuid.uuid4()
    app = DummyApplication(
        id=app_id,
        applicant_name="Deepak Verma",
        applicant_email="deepak.verma@example.com",
    )

    # 1. Test APPLICATION_SUBMITTED
    notification_service.notify(
        NotificationEvent.APPLICATION_SUBMITTED,
        app,
        {"scheme_code": "NOS"},
    )

    assert "Would send email to deepak.verma@example.com" in caplog.text
    assert str(app_id) in caplog.text
    assert "submitted successfully" in caplog.text
    assert "APPLICATION_SUBMITTED" in caplog.text

    # 2. Test SELECTION_APPROVED
    caplog.clear()
    notification_service.notify(
        NotificationEvent.SELECTION_APPROVED,
        app,
    )
    assert "Would send email to deepak.verma@example.com" in caplog.text
    assert "Congratulations Deepak Verma" in caplog.text
    assert "approved by the selection committee" in caplog.text
    assert "SELECTION_APPROVED" in caplog.text

    # 3. Test DISBURSEMENT_COMPLETED
    caplog.clear()
    notification_service.notify(
        NotificationEvent.DISBURSEMENT_COMPLETED,
        app,
        {"amount": 50000.0, "installment_number": 1},
    )
    assert "Would send email to deepak.verma@example.com" in caplog.text
    assert "scholarship disbursement" in caplog.text
    assert "completed successfully" in caplog.text

    # 4. Test RENEWAL_DUE
    caplog.clear()
    notification_service.notify(
        NotificationEvent.RENEWAL_DUE,
        app,
        {"due_date": "2027-04-30"},
    )
    assert "renewal review cycle" in caplog.text
    assert "2027-04-30" in caplog.text


def test_notify_exception_does_not_propagate(caplog):
    """An internal exception inside notification dispatch is caught and does not bubble up."""
    caplog.set_level(logging.ERROR, logger="app.notifications")

    app = DummyApplication(
        id=uuid.uuid4(),
        applicant_name="Sunil Rao",
        applicant_email="sunil@example.com",
    )

    # Simulate an unexpected failure in _send
    with patch.object(NotificationService, "_send", side_effect=RuntimeError("SMTP connection timed out")):
        try:
            # Should NOT raise RuntimeError
            notification_service.notify(NotificationEvent.APPLICATION_SUBMITTED, app)
        except Exception as exc:
            pytest.fail(f"notify() allowed an exception to propagate: {exc}")

    assert "Notification dispatch failed" in caplog.text
    assert "SMTP connection timed out" in caplog.text
