"""
Notification service for application lifecycle events.

This service dispatches notifications across critical application lifecycle moments:
submission, eligibility evaluation, document scrutiny, committee selection,
disbursements, and renewal review cycles.

NOTE: This is a stub implementation that logs structured messages using Python's
logging module. In a production environment, this class will be swapped with email/SMS
delivery providers (e.g. Resend, SendGrid, or AWS SES) per the architectural plan.
The interface is designed as a drop-in replacement so swapping implementation
requires zero changes to call sites.
"""

import enum
import logging
from typing import Any, Dict, Optional

logger = logging.getLogger("app.notifications")


class NotificationEvent(str, enum.Enum):
    """Lifecycle events triggering notifications."""
    APPLICATION_SUBMITTED = "APPLICATION_SUBMITTED"
    ELIGIBILITY_FAILED = "ELIGIBILITY_FAILED"
    DOCUMENTS_VERIFIED = "DOCUMENTS_VERIFIED"
    DOCUMENTS_DEFICIENT = "DOCUMENTS_DEFICIENT"
    SELECTION_APPROVED = "SELECTION_APPROVED"
    SELECTION_REJECTED = "SELECTION_REJECTED"
    DISBURSEMENT_COMPLETED = "DISBURSEMENT_COMPLETED"
    RENEWAL_DUE = "RENEWAL_DUE"


class NotificationService:
    """
    Notification dispatching service.

    Guarantees that notification failures never bubble up or block core business
    transactions (fail-safe dispatch).
    """

    @classmethod
    def notify(
        cls,
        event: NotificationEvent,
        application: Any,
        extra: Optional[Dict[str, Any]] = None,
    ) -> None:
        """
        Send a notification for the specified event.

        Exceptions raised during notification processing are caught and logged at
        ERROR level without propagating to the caller.
        """
        try:
            cls._send(event, application, extra or {})
        except Exception as exc:
            logger.error(
                "Notification dispatch failed for event %s on application %s: %s",
                event,
                getattr(application, "id", None),
                exc,
                exc_info=True,
            )

    @classmethod
    def _send(
        cls,
        event: NotificationEvent,
        application: Any,
        extra: Dict[str, Any],
    ) -> None:
        applicant_email = getattr(application, "applicant_email", "unknown@example.com")
        applicant_name = getattr(application, "applicant_name", "Applicant")
        app_id = getattr(application, "id", "unknown")

        messages = {
            NotificationEvent.APPLICATION_SUBMITTED: (
                f"Would send email to {applicant_email}: Dear {applicant_name}, your application "
                f"{app_id} has been submitted successfully and is queued for verification."
            ),
            NotificationEvent.ELIGIBILITY_FAILED: (
                f"Would send email to {applicant_email}: Dear {applicant_name}, your application "
                f"{app_id} did not meet the scheme eligibility criteria."
            ),
            NotificationEvent.DOCUMENTS_VERIFIED: (
                f"Would send email to {applicant_email}: Dear {applicant_name}, all documents for your "
                f"application {app_id} have been verified successfully and forwarded to the selection committee."
            ),
            NotificationEvent.DOCUMENTS_DEFICIENT: (
                f"Would send email to {applicant_email}: Dear {applicant_name}, deficiencies were identified "
                f"in documents for application {app_id}. Please review the deficiency summary and re-upload."
            ),
            NotificationEvent.SELECTION_APPROVED: (
                f"Would send email to {applicant_email}: Congratulations {applicant_name}! Your application "
                f"{app_id} has been approved by the selection committee."
            ),
            NotificationEvent.SELECTION_REJECTED: (
                f"Would send email to {applicant_email}: Dear {applicant_name}, we regret to inform you that "
                f"application {app_id} was not selected by the committee."
            ),
            NotificationEvent.DISBURSEMENT_COMPLETED: (
                f"Would send email to {applicant_email}: Dear {applicant_name}, a scholarship disbursement "
                f"for application {app_id} has been completed successfully."
            ),
            NotificationEvent.RENEWAL_DUE: (
                f"Would send email to {applicant_email}: Dear {applicant_name}, a renewal review cycle "
                f"for application {app_id} has been initiated. Due date: {extra.get('due_date', 'N/A')}."
            ),
        }

        content = messages.get(
            event,
            f"Would send email to {applicant_email}: Notification for event {event} on application {app_id}."
        )

        logger.info(
            "%s [event=%s, application_id=%s, email=%s, extra=%s]",
            content,
            event.value if hasattr(event, "value") else str(event),
            app_id,
            applicant_email,
            extra,
        )


notification_service = NotificationService()
