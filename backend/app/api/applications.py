"""
Applications API router.

Endpoints for creating applications, querying state, triggering transitions,
and retrieving audit logs.
"""

import uuid
from typing import Annotated, Any, Dict, List, Optional
from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.core.deps import get_current_user, require_any_role
from app.models.application import Application
from app.models.audit_log import AuditLog
from app.models.scheme import Scheme
from app.models.user import User
from app.schemas.application import ApplicationCreate, ApplicationRead
from app.schemas.scheme_config import WorkflowTransition
from app.services.workflow_engine import WorkflowEngine, InvalidTransitionError
from app.services.eligibility_engine import EligibilityResult, FailedRule
from app.services.notification_service import notification_service, NotificationEvent

router = APIRouter(prefix="/applications", tags=["Applications"])


@router.get("", response_model=List[ApplicationRead])
def list_applications(
    scheme_id: Optional[str] = Query(None, description="Filter by scheme ID"),
    current_state: Optional[str] = Query(None, description="Filter by current state"),
    page: int = Query(1, ge=1, description="Page number"),
    page_size: int = Query(50, ge=1, le=200, description="Items per page"),
    current_user: Annotated[User, Depends(require_any_role)] = None,
    db: Session = Depends(get_db),
) -> List[Application]:
    """
    List all applications with optional filtering and pagination.

    Any authenticated role can access.
    """
    query = db.query(Application)

    if scheme_id:
        query = query.filter(Application.scheme_id == scheme_id)
    if current_state:
        query = query.filter(Application.current_state == current_state)

    offset = (page - 1) * page_size
    applications = query.order_by(Application.created_at.desc()).offset(offset).limit(page_size).all()
    return applications


# Intentionally unauthenticated: applicant self-service endpoint.
# Access control is via the unguessable applicationId in the URL (generated upon creation),
# per the plan's stated hackathon-scope limitation.
@router.post("", response_model=ApplicationRead, status_code=201)
def create_application(
    payload: ApplicationCreate,
    db: Session = Depends(get_db)
) -> Application:
    """
    Create a new Application for a scheme.

    Sets current_state to the scheme config's initial_state and writes
    an AuditLog row with action="application_created".
    """
    # Verify scheme exists and is active
    scheme = db.query(Scheme).filter(Scheme.id == payload.scheme_id, Scheme.is_active == True).first()
    if not scheme:
        raise HTTPException(status_code=404, detail="Scheme not found or inactive")

    # Get initial state from scheme config
    from app.services.scheme_config_validator import validate_scheme_config
    config = validate_scheme_config(scheme.config)
    initial_state = config.initial_state

    # Create application
    application = Application(
        scheme_id=payload.scheme_id,
        applicant_name=payload.applicant_name,
        applicant_email=payload.applicant_email,
        applicant_phone=payload.applicant_phone,
        applicant_data=payload.applicant_data,
        current_state=initial_state,
    )
    db.add(application)
    db.flush()

    # Create audit log for application creation
    audit_log = AuditLog(
        application_id=application.id,
        scheme_id=scheme.id,
        actor_user_id=None,
        action="application_created",
        from_state=None,
        to_state=initial_state,
        details={"applicant_data": payload.applicant_data},
    )
    db.add(audit_log)

    db.commit()
    db.refresh(application)

    notification_service.notify(
        NotificationEvent.APPLICATION_SUBMITTED,
        application,
        {"scheme_code": scheme.code},
    )

    return application


# Intentionally unauthenticated: applicant self-service status page.
# Access control is via the unguessable applicationId in the URL,
# per the plan's stated hackathon-scope limitation.
@router.get("/{application_id}", response_model=ApplicationRead)
def get_application(
    application_id: uuid.UUID,
    db: Session = Depends(get_db)
) -> Application:
    """Fetch an application by ID with its current state. Intentionally unauthenticated for applicant self-service."""
    application = db.query(Application).filter(Application.id == application_id).first()
    if not application:
        raise HTTPException(status_code=404, detail="Application not found")
    return application


@router.get("/{application_id}/available-transitions", response_model=List[WorkflowTransition])
def get_available_transitions(
    application_id: uuid.UUID,
    current_user: Annotated[User, Depends(require_any_role)],
    db: Session = Depends(get_db)
) -> List[WorkflowTransition]:
    """List transitions available from the application's current state for the authenticated user's role."""
    application = db.query(Application).filter(Application.id == application_id).first()
    if not application:
        raise HTTPException(status_code=404, detail="Application not found")

    engine = WorkflowEngine(db)
    transitions = engine.get_available_transitions(application, user_role=current_user.role.value)
    return transitions


class TransitionRequest(BaseModel):
    """Request body for applying a transition."""
    trigger: str
    details: Optional[Dict[str, Any]] = None


@router.post("/{application_id}/transition", response_model=ApplicationRead)
def apply_transition(
    application_id: uuid.UUID,
    request: TransitionRequest,
    current_user: Annotated[User, Depends(require_any_role)],
    db: Session = Depends(get_db)
) -> Application:
    """
    Apply a transition to the application.

    Body:
    {
        "trigger": "eligibility_passed",
        "details": {...}  // optional
    }

    The authenticated user's ID is used as actor_user_id and their role
    is checked against the transition's allowed_roles.
    """
    application = db.query(Application).filter(Application.id == application_id).first()
    if not application:
        raise HTTPException(status_code=404, detail="Application not found")

    trigger = request.trigger
    details = request.details

    engine = WorkflowEngine(db)

    # Pre-validate role-gated transitions using authenticated user's role
    available = engine.get_available_transitions(application, user_role=current_user.role.value)
    available_triggers = [t.trigger for t in available]
    if trigger not in available_triggers:
        raise HTTPException(
            status_code=400,
            detail={
                "error": "Invalid transition",
                "message": f"Trigger '{trigger}' not available from state '{application.current_state}' for role '{current_user.role.value}'. Available: {available_triggers}",
                "current_state": application.current_state,
                "available_triggers": available_triggers,
            }
        )

    try:
        updated_application = engine.apply_transition(
            application=application,
            trigger=trigger,
            actor_user_id=current_user.id,
            details=details
        )
    except InvalidTransitionError as exc:
        raise HTTPException(
            status_code=400,
            detail={
                "error": "InvalidTransitionError",
                "message": str(exc),
                "current_state": exc.current_state,
                "trigger": exc.trigger,
                "allowed_roles": exc.allowed_roles,
            }
        ) from exc

    return updated_application


@router.get("/{application_id}/audit-log")
def get_audit_log(
    application_id: uuid.UUID,
    current_user: Annotated[User, Depends(require_any_role)],
    db: Session = Depends(get_db)
) -> List[Dict[str, Any]]:
    """Return all AuditLog rows for this application, ordered by created_at. Requires authentication."""
    application = db.query(Application).filter(Application.id == application_id).first()
    if not application:
        raise HTTPException(status_code=404, detail="Application not found")

    logs = db.query(AuditLog).filter(
        AuditLog.application_id == application_id
    ).order_by(AuditLog.created_at.asc()).all()

    return [
        {
            "id": str(log.id),
            "action": log.action,
            "from_state": log.from_state,
            "to_state": log.to_state,
            "actor_user_id": str(log.actor_user_id) if log.actor_user_id else None,
            "details": log.details,
            "created_at": log.created_at.isoformat() if log.created_at else None,
        }
        for log in logs
    ]


class FailedRuleRead(BaseModel):
    """Failed eligibility rule for API response."""
    field: str
    failure_message: str
    condition: dict


class EligibilityResultRead(BaseModel):
    """Eligibility evaluation result for API response."""
    passed: bool
    failed_rules: List[FailedRuleRead]


class RunEligibilityCheckResponse(BaseModel):
    """Response for run-eligibility-check endpoint."""
    application: ApplicationRead
    eligibility_result: EligibilityResultRead


# Intentionally unauthenticated: applicant self-service evaluation flow.
# Access control is via the unguessable applicationId in the URL,
# per the plan's stated hackathon-scope limitation.
@router.post("/{application_id}/run-eligibility-check", response_model=RunEligibilityCheckResponse)
def run_eligibility_check(
    application_id: uuid.UUID,
    db: Session = Depends(get_db)
) -> RunEligibilityCheckResponse:
    """
    Run automatic eligibility evaluation for an application.

    Evaluates all eligibility rules from the scheme config against the
    application's stored applicant_data. Automatically transitions the
    application to the next state (eligibility_passed -> document_scrutiny,
    or eligibility_failed -> rejected) and returns the updated application
    plus detailed eligibility results.

    Intentionally unauthenticated for applicant self-service.
    """
    application = db.query(Application).filter(Application.id == application_id).first()
    if not application:
        raise HTTPException(status_code=404, detail="Application not found")

    engine = WorkflowEngine(db)

    # If application is in initial state (e.g. "submitted"), advance to "eligibility_check" if transition exists
    from app.services.scheme_config_validator import validate_scheme_config
    config = validate_scheme_config(application.scheme.config)
    if application.current_state == config.initial_state:
        for transition in config.workflow_transitions:
            if transition.from_state == application.current_state and transition.to_state == "eligibility_check":
                application = engine.apply_transition(application, transition.trigger, actor_user_id=None)
                break

    try:
        updated_application, result = engine.run_eligibility_check(application)
    except InvalidTransitionError as exc:
        raise HTTPException(
            status_code=400,
            detail={
                "error": "InvalidTransitionError",
                "message": str(exc),
                "current_state": exc.current_state,
                "trigger": exc.trigger,
                "allowed_roles": exc.allowed_roles,
            }
        ) from exc

    eligibility_result_read = EligibilityResultRead(
        passed=result.passed,
        failed_rules=[
            FailedRuleRead(field=fr.field, failure_message=fr.failure_message, condition=fr.condition)
            for fr in result.failed_rules
        ]
    )

    return RunEligibilityCheckResponse(
        application=updated_application,
        eligibility_result=eligibility_result_read
    )