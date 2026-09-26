"""
Notification service for application lifecycle events and Communication Center.

Provides multi-channel dispatch across:
- PORTAL (in-app notifications)
- EMAIL (email sandbox adapter / live SMTP adapter)
- SMS (SMS sandbox adapter)

Maintains persistent notification history, fail-safe transaction isolation,
and correlation tracking for Ministry of Tribal Affairs (SIH26239).
"""

from abc import ABC, abstractmethod
from datetime import datetime
import enum
import logging
from typing import Any, Dict, List, Optional
import uuid

from sqlalchemy.orm import Session

from app.models.notification import Notification, NotificationChannel, DeliveryStatus

logger = logging.getLogger("app.notifications")


class NotificationEvent(str, enum.Enum):
    """Lifecycle events triggering notifications."""
    APPLICATION_RECEIVED = "APPLICATION_RECEIVED"
    APPLICATION_SUBMITTED = "APPLICATION_SUBMITTED"
    DOCUMENT_DEFICIENCY = "DOCUMENT_DEFICIENCY"
    DEFICIENCY_RESOLVED = "DEFICIENCY_RESOLVED"
    ELIGIBILITY_RESULT = "ELIGIBILITY_RESULT"
    ELIGIBILITY_FAILED = "ELIGIBILITY_FAILED"
    DOCUMENTS_VERIFIED = "DOCUMENTS_VERIFIED"
    DOCUMENTS_DEFICIENT = "DOCUMENTS_DEFICIENT"
    SCRUTINY_COMPLETED = "SCRUTINY_COMPLETED"
    SELECTION_RESULT = "SELECTION_RESULT"
    SELECTION_APPROVED = "SELECTION_APPROVED"
    SELECTION_REJECTED = "SELECTION_REJECTED"
    DISBURSEMENT_PROCESSED = "DISBURSEMENT_PROCESSED"
    DISBURSEMENT_COMPLETED = "DISBURSEMENT_COMPLETED"
    RENEWAL_REQUIRED = "RENEWAL_REQUIRED"
    RENEWAL_DUE = "RENEWAL_DUE"
    GRIEVANCE_CREATED = "GRIEVANCE_CREATED"
    GRIEVANCE_UPDATED = "GRIEVANCE_UPDATED"
    POLICY_ADMIN_NOTICE = "POLICY_ADMIN_NOTICE"


class BaseNotificationAdapter(ABC):
    """Abstract communication channel adapter."""

    @abstractmethod
    def deliver(self, recipient: str, subject: str, message: str, metadata: Dict[str, Any]) -> DeliveryStatus:
        """Deliver the message via the adapter's channel."""
        pass


class InAppNotificationAdapter(BaseNotificationAdapter):
    """In-app portal notification adapter."""

    def deliver(self, recipient: str, subject: str, message: str, metadata: Dict[str, Any]) -> DeliveryStatus:
        logger.info("[PORTAL_INBOX] Delivered notification to %s: %s", recipient, subject)
        return DeliveryStatus.DELIVERED


class EmailSandboxAdapter(BaseNotificationAdapter):
    """Email delivery adapter operating in prototype sandbox mode."""

    def deliver(self, recipient: str, subject: str, message: str, metadata: Dict[str, Any]) -> DeliveryStatus:
        logger.info("[EMAIL_SANDBOX] Sent email to %s | Subject: %s | Correlation: %s", recipient, subject, metadata.get("correlation_id"))
        return DeliveryStatus.SIMULATED


class SMSSandboxAdapter(BaseNotificationAdapter):
    """SMS delivery adapter operating in prototype sandbox mode."""

    def deliver(self, recipient: str, subject: str, message: str, metadata: Dict[str, Any]) -> DeliveryStatus:
        short_msg = (message[:157] + "...") if len(message) > 160 else message
        logger.info("[SMS_SANDBOX] Sent SMS to %s | %s", recipient, short_msg)
        return DeliveryStatus.SIMULATED


ADAPTERS: Dict[NotificationChannel, BaseNotificationAdapter] = {
    NotificationChannel.PORTAL: InAppNotificationAdapter(),
    NotificationChannel.EMAIL: EmailSandboxAdapter(),
    NotificationChannel.SMS: SMSSandboxAdapter(),
}


def _render_template(event: NotificationEvent, applicant_name: str, app_id: str, extra: Dict[str, Any]) -> Dict[str, str]:
    """Generate structured subject and body text per notification template."""
    templates = {
        NotificationEvent.APPLICATION_SUBMITTED: {
            "subject": f"Application Received — {app_id}",
            "body": f"Dear {applicant_name}, your application {app_id} has been submitted successfully and is queued for verification.",
        },
        NotificationEvent.APPLICATION_RECEIVED: {
            "subject": f"Application Received — {app_id}",
            "body": f"Dear {applicant_name}, your scholarship application {app_id} has been received by the Ministry portal.",
        },
        NotificationEvent.ELIGIBILITY_FAILED: {
            "subject": f"Eligibility Status Update — {app_id}",
            "body": f"Dear {applicant_name}, your application {app_id} did not meet the scheme eligibility criteria.",
        },
        NotificationEvent.ELIGIBILITY_RESULT: {
            "subject": f"Eligibility Evaluation Completed — {app_id}",
            "body": f"Dear {applicant_name}, your application {app_id} eligibility has been evaluated: {extra.get('verdict', 'EVALUATED')}.",
        },
        NotificationEvent.DOCUMENTS_VERIFIED: {
            "subject": f"Documents Scrutiny Passed — {app_id}",
            "body": f"Dear {applicant_name}, all documents for your application {app_id} have been verified successfully and forwarded to the selection committee.",
        },
        NotificationEvent.DOCUMENTS_DEFICIENT: {
            "subject": f"Action Required: Document Deficiency Flagged — {app_id}",
            "body": f"Dear {applicant_name}, deficiencies were identified in documents for application {app_id}. Please review the deficiency summary and re-upload.",
        },
        NotificationEvent.DOCUMENT_DEFICIENCY: {
            "subject": f"Action Required: Document Deficiency — {app_id}",
            "body": f"Dear {applicant_name}, {extra.get('doc_type', 'A document')} requires replacement: {extra.get('reason', 'Invalid or unreadable')}. Deadline: {extra.get('deadline', '7 days')}.",
        },
        NotificationEvent.DEFICIENCY_RESOLVED: {
            "subject": f"Deficiency Resolved — {app_id}",
            "body": f"Dear {applicant_name}, your resubmitted replacement document for {app_id} has been accepted and verified.",
        },
        NotificationEvent.SCRUTINY_COMPLETED: {
            "subject": f"Scrutiny Phase Completed — {app_id}",
            "body": f"Dear {applicant_name}, institutional and document scrutiny for {app_id} is complete.",
        },
        NotificationEvent.SELECTION_APPROVED: {
            "subject": f"Congratulations! Scholarship Awarded — {app_id}",
            "body": f"Congratulations {applicant_name}! Your application {app_id} has been approved by the selection committee.",
        },
        NotificationEvent.SELECTION_REJECTED: {
            "subject": f"Selection Committee Outcome — {app_id}",
            "body": f"Dear {applicant_name}, we regret to inform you that application {app_id} was not selected by the committee.",
        },
        NotificationEvent.SELECTION_RESULT: {
            "subject": f"Selection Committee Result — {app_id}",
            "body": f"Dear {applicant_name}, the selection committee has finalized decisions for application {app_id}.",
        },
        NotificationEvent.DISBURSEMENT_COMPLETED: {
            "subject": f"Scholarship Disbursement Processed — {app_id}",
            "body": f"Dear {applicant_name}, a scholarship disbursement for application {app_id} has been completed successfully.",
        },
        NotificationEvent.DISBURSEMENT_PROCESSED: {
            "subject": f"Scholarship Tranche Processed — {app_id}",
            "body": f"Dear {applicant_name}, installment #{extra.get('installment', 1)} of ₹{extra.get('amount', 'N/A')} has been processed via PFMS/DBT.",
        },
        NotificationEvent.RENEWAL_DUE: {
            "subject": f"Scholarship Renewal Cycle Due — {app_id}",
            "body": f"Dear {applicant_name}, a renewal review cycle for application {app_id} has been initiated. Due date: {extra.get('due_date', 'N/A')}.",
        },
        NotificationEvent.RENEWAL_REQUIRED: {
            "subject": f"Action Required: Annual Renewal Submission — {app_id}",
            "body": f"Dear {applicant_name}, please submit your academic progress report and bonafide certificate for renewal before {extra.get('due_date', 'due date')}.",
        },
        NotificationEvent.GRIEVANCE_CREATED: {
            "subject": f"Grievance Ticket Registered — {extra.get('ticket_id', app_id)}",
            "body": f"Dear {applicant_name}, your grievance ticket has been registered and assigned to a Nodal Officer.",
        },
        NotificationEvent.GRIEVANCE_UPDATED: {
            "subject": f"Grievance Status Update — {extra.get('ticket_id', app_id)}",
            "body": f"Dear {applicant_name}, your grievance has been updated with resolution remarks.",
        },
        NotificationEvent.POLICY_ADMIN_NOTICE: {
            "subject": "Ministry Operational Notice",
            "body": f"Dear {applicant_name}, {extra.get('message', 'A scheme policy notification has been published.')}",
        },
    }

    item = templates.get(
        event,
        {
            "subject": f"Notification — {app_id}",
            "body": f"Notification for event {event} on application {app_id}.",
        }
    )
    return item


class NotificationService:
    """
    Enterprise Notification Dispatcher and History Manager.
    Guarantees that notification failures never block core business transactions.
    """

    @classmethod
    def notify(
        cls,
        event: NotificationEvent,
        application: Any,
        extra: Optional[Dict[str, Any]] = None,
        db: Optional[Session] = None,
        channels: Optional[List[NotificationChannel]] = None,
    ) -> None:
        """
        Send a notification for the specified event across requested channels.
        Guaranteed not to raise unhandled exceptions.
        """
        try:
            cls._send(event, application, extra or {}, db=db, channels=channels)
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
        db: Optional[Session] = None,
        channels: Optional[List[NotificationChannel]] = None,
    ) -> None:
        applicant_email = getattr(application, "applicant_email", "unknown@example.com")
        applicant_name = getattr(application, "applicant_name", "Applicant")
        raw_app_id = getattr(application, "id", None)
        app_id_str = str(raw_app_id) if raw_app_id else "unknown"

        # Render message template
        rendered = _render_template(event, applicant_name, app_id_str, extra)
        subject = rendered["subject"]
        body = rendered["body"]

        # 1. Maintain backward-compatible logging expected by tests
        logger.info(
            "Would send email to %s: %s [event=%s, application_id=%s, email=%s, extra=%s]",
            applicant_email,
            body,
            event.value if hasattr(event, "value") else str(event),
            app_id_str,
            applicant_email,
            extra,
        )

        # 2. Dispatch to designated channels (defaults to PORTAL and EMAIL)
        active_channels = channels or [NotificationChannel.PORTAL, NotificationChannel.EMAIL]
        correlation_id = str(uuid.uuid4())

        for ch in active_channels:
            adapter = ADAPTERS.get(ch, EmailSandboxAdapter())
            metadata = {
                "correlation_id": correlation_id,
                "retry_count": 0,
                "sent_at": datetime.utcnow().isoformat(),
                "template_name": str(event),
                "extra": extra,
            }
            status = adapter.deliver(applicant_email, subject, body, metadata)

            # 3. Persist record if database session is provided
            if db is not None:
                try:
                    app_uuid = uuid.UUID(app_id_str) if isinstance(raw_app_id, uuid.UUID) or (isinstance(raw_app_id, str) and len(raw_app_id) == 36) else None
                    notif = Notification(
                        application_id=app_uuid,
                        recipient_email=applicant_email,
                        recipient_name=applicant_name,
                        event=event.value if hasattr(event, "value") else str(event),
                        channel=ch,
                        subject=subject,
                        message=body,
                        delivery_status=status,
                        extra_metadata=metadata,
                    )
                    db.add(notif)
                    db.commit()
                except Exception as db_exc:
                    logger.debug("Could not persist notification row: %s", db_exc)
                    try:
                        db.rollback()
                    except Exception:
                        pass


notification_service = NotificationService()
