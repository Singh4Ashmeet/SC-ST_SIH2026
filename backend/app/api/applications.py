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

from app.core.cache import cache
from app.core.database import get_db
from app.core.deps import get_current_user, require_any_role, get_optional_current_user
from app.models.application import Application
from app.models.audit_log import AuditLog
from app.models.document import Document
from app.models.conflict import Conflict
from app.models.merit_evaluation import MeritEvaluation
from app.models.institute_verification import InstituteVerification
from app.models.grievance import Grievance
from app.models.scheme import Scheme
from app.models.user import User
from app.schemas.application import ApplicationCreate, ApplicationRead
from app.schemas.scheme_config import WorkflowTransition
from app.services.workflow_engine import WorkflowEngine, InvalidTransitionError
from app.services.eligibility_engine import EligibilityResult, FailedRule, evaluate_eligibility
from app.services.notification_service import notification_service, NotificationEvent

router = APIRouter(prefix="/applications", tags=["Applications"])


@router.get("", response_model=List[ApplicationRead])
def list_applications(
    scheme_id: Optional[str] = Query(None, description="Filter by scheme ID"),
    current_state: Optional[str] = Query(None, description="Filter by current state"),
    queue: Optional[str] = Query(None, description="Filter by operational work queue: scrutiny, institute, selection, nodal, all"),
    search: Optional[str] = Query(None, description="Search applicant name, email, or ID"),
    page: int = Query(1, ge=1, description="Page number"),
    page_size: int = Query(50, ge=1, le=200, description="Items per page"),
    current_user: Annotated[User, Depends(require_any_role)] = None,
    db: Session = Depends(get_db),
) -> List[Application]:
    """
    List applications scoped to the authenticated user's role and operational permissions.
    Supports role-scoped queues (scrutiny, institute, selection, nodal).
    """
    query = db.query(Application)

    # 1. Apply role-based scope filtering
    if current_user.role == UserRole.SCRUTINY_OFFICER:
        if current_user.state_scope:
            query = query.filter((Application.state == current_user.state_scope) | (Application.state.is_(None)))
        # Scrutiny queue filtering
        if queue == "scrutiny" or not queue:
            scrutiny_states = ["submitted", "document_scrutiny", "deficiency_flagged", "resubmitted", "under_scrutiny"]
            query = query.filter(Application.current_state.in_(scrutiny_states))

    elif current_user.role == UserRole.INSTITUTE_VERIFIER:
        if current_user.institution_id:
            query = query.filter(
                (Application.institution_id == current_user.institution_id) |
                (Application.applicant_data["institution_id"].astext == current_user.institution_id) |
                (Application.applicant_data["institution"].astext.ilike(f"%{current_user.institution_id}%"))
            )
        if queue == "institute" or not queue:
            query = query.filter(Application.current_state.in_(["institute_verification", "pending_institute_verification"]))

    elif current_user.role == UserRole.SELECTION_COMMITTEE:
        if queue == "selection" or not queue:
            selection_states = ["merit_evaluated", "selection", "committee_review", "approved", "rejected", "held", "selected", "awarded"]
            query = query.filter(Application.current_state.in_(selection_states))

    elif current_user.role == UserRole.NODAL_OFFICER:
        if current_user.state_scope:
            query = query.filter(Application.state == current_user.state_scope)

    elif current_user.role == UserRole.APPLICANT:
        query = query.filter(Application.applicant_email.ilike(current_user.email))

    # 2. Apply explicit query filters
    if scheme_id:
        query = query.filter(Application.scheme_id == scheme_id)
    if current_state:
        query = query.filter(Application.current_state == current_state)
    if queue and queue != "all":
        if queue == "scrutiny":
            query = query.filter(Application.current_state.in_(["submitted", "document_scrutiny", "deficiency_flagged", "resubmitted"]))
        elif queue == "institute":
            query = query.filter(Application.current_state.in_(["institute_verification", "pending_institute_verification"]))
        elif queue == "selection":
            query = query.filter(Application.current_state.in_(["merit_evaluated", "selection", "committee_review"]))
    if search:
        search_pattern = f"%{search}%"
        query = query.filter(
            (Application.applicant_name.ilike(search_pattern)) |
            (Application.applicant_email.ilike(search_pattern))
        )

    offset = (page - 1) * page_size
    applications = list(query.order_by(Application.created_at.desc()).offset(offset).limit(page_size).all())
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


@router.get("/{application_id}/case-file")
def get_case_file(
    application_id: uuid.UUID,
    current_user: Annotated[Optional[User], Depends(get_optional_current_user)] = None,
    db: Session = Depends(get_db),
) -> Dict[str, Any]:
    """
    Unified Application Case File endpoint.
    Aggregates all application information, scheme config, documents, OCR findings,
    eligibility checks, conflicts, merit evaluation, institute verification,
    grievances, audit trail, and role-permitted workflow actions into one screen payload.
    """
    application = db.query(Application).filter(Application.id == application_id).first()
    if not application:
        raise HTTPException(status_code=404, detail="Application not found")

    scheme = application.scheme
    from app.services.scheme_config_validator import validate_scheme_config
    scheme_config = validate_scheme_config(scheme.config) if scheme else None

    # 1. Documents & Extracted Fields
    documents = db.query(Document).filter(Document.application_id == application_id).all()
    doc_list = []
    for d in documents:
        doc_list.append({
            "id": str(d.id),
            "doc_type": d.doc_type,
            "status": d.status.value if hasattr(d.status, "value") else str(d.status),
            "extracted_fields": d.extracted_fields,
            "deficiency_reasons": d.deficiency_reasons,
            "uploaded_at": d.uploaded_at.isoformat() if d.uploaded_at else None,
            "download_url": f"/api/applications/documents/{d.id}/file",
        })

    # 2. Eligibility Evaluation
    eligibility_result = None
    if scheme:
        try:
            eval_res = evaluate_eligibility(scheme.config, application.applicant_data)
            eligibility_result = {
                "passed": eval_res.passed,
                "failed_rules": [
                    {
                        "field": fr.field,
                        "failure_message": fr.failure_message,
                        "condition": fr.condition,
                    }
                    for fr in eval_res.failed_rules
                ]
            }
        except Exception:
            pass

    # 3. Cross-Scheme Conflict
    conflict = db.query(Conflict).filter(
        (Conflict.primary_application_id == application_id) | 
        (Conflict.conflicting_application_id == application_id)
    ).first()
    conflict_data = None
    if conflict:
        conflict_data = {
            "id": str(conflict.id),
            "status": conflict.status.value if hasattr(conflict.status, "value") else str(conflict.status),
            "match_confidence": conflict.match_confidence,
            "matching_signals": conflict.matching_signals,
            "resolution_notes": conflict.resolution_notes,
        }

    # 4. Merit Evaluation
    merit = db.query(MeritEvaluation).filter(MeritEvaluation.application_id == application_id).first()
    merit_data = None
    if merit:
        merit_data = {
            "id": str(merit.id),
            "academic_score": merit.academic_score,
            "research_score": merit.research_score,
            "experience_score": merit.experience_score,
            "preference_score": merit.preference_score,
            "total_score": merit.total_score,
            "rank": merit.rank,
            "decision": merit.decision.value if hasattr(merit.decision, "value") else str(merit.decision),
            "committee_remarks": merit.committee_remarks,
        }

    # 5. Institute Verification
    inst_ver = db.query(InstituteVerification).filter(InstituteVerification.application_id == application_id).first()
    inst_data = None
    if inst_ver:
        inst_data = {
            "id": str(inst_ver.id),
            "institution_name": inst_ver.institution_name,
            "institution_code": inst_ver.institution_code,
            "status": inst_ver.status.value if hasattr(inst_ver.status, "value") else str(inst_ver.status),
            "remarks": inst_ver.remarks,
            "query_details": inst_ver.query_details,
            "verified_at": inst_ver.verified_at.isoformat() if inst_ver.verified_at else None,
        }

    # 6. Grievances
    grievances = db.query(Grievance).filter(Grievance.application_id == application_id).all()
    grievance_list = [
        {
            "id": str(g.id),
            "grievance_number": g.grievance_number,
            "category": g.category.value if hasattr(g.category, "value") else str(g.category),
            "subject": g.subject,
            "status": g.status.value if hasattr(g.status, "value") else str(g.status),
            "priority": g.priority.value if hasattr(g.priority, "value") else str(g.priority),
            "created_at": g.created_at.isoformat() if g.created_at else None,
        }
        for g in grievances
    ]

    # 7. Audit Trail Timeline
    audit_logs = db.query(AuditLog).filter(AuditLog.application_id == application_id).order_by(AuditLog.created_at.asc()).all()
    audit_list = [
        {
            "id": str(a.id),
            "action": a.action,
            "from_state": a.from_state,
            "to_state": a.to_state,
            "actor_user_id": str(a.actor_user_id) if a.actor_user_id else None,
            "details": a.details,
            "created_at": a.created_at.isoformat() if a.created_at else None,
        }
        for a in audit_logs
    ]

    # 8. Available Transitions for current role
    engine = WorkflowEngine(db)
    user_role = current_user.role.value if current_user else "APPLICANT"
    transitions = engine.get_available_transitions(application, user_role=user_role)
    available_transitions = [
        {"trigger": t.trigger, "from_state": t.from_state, "to_state": t.to_state, "label": t.trigger.replace("_", " ").title()}
        for t in transitions
    ]

    # 9. Dynamic SLA Calculation
    from datetime import datetime, timezone, timedelta
    entry_time = application.stage_entry_time or application.updated_at or application.created_at
    if entry_time and entry_time.tzinfo is None:
        entry_time = entry_time.replace(tzinfo=timezone.utc)
    now = datetime.now(timezone.utc)
    
    sla_hours_map = {
        "submitted": 24,
        "eligibility_check": 24,
        "document_scrutiny": 48,
        "deficiency_flagged": 72,
        "resubmitted": 24,
        "scrutiny_completed": 24,
        "institute_verification": 72,
        "merit_evaluated": 48,
        "selection": 96,
        "committee_review": 96,
        "approved": 120,
        "disbursed": 120,
    }
    stage_sla_hours = sla_hours_map.get(application.current_state.lower(), 48)
    deadline = entry_time + timedelta(hours=stage_sla_hours) if entry_time else now + timedelta(hours=48)
    diff = deadline - now
    total_seconds = int(diff.total_seconds())
    is_breached = total_seconds < 0
    abs_seconds = abs(total_seconds)
    hours = abs_seconds // 3600
    minutes = (abs_seconds % 3600) // 60
    
    formatted_sla = f"SLA BREACHED ({hours}h {minutes}m overdue)" if is_breached else f"{hours}h {minutes}m remaining"

    sla_data = {
        "stage_entry_time": entry_time.isoformat() if entry_time else None,
        "deadline": deadline.isoformat(),
        "sla_hours": stage_sla_hours,
        "is_breached": is_breached,
        "remaining_hours": hours if not is_breached else -hours,
        "remaining_minutes": minutes,
        "formatted_status": formatted_sla,
    }

    # 10. Case Decision Summary
    case_decision_summary = {
        "eligibility_status": "PASS" if (eligibility_result and eligibility_result.get("passed")) else ("FAIL" if eligibility_result else "PENDING"),
        "documents_status": "DEFICIENT" if any(d.get("status") in ["DEFICIENT", "REJECTED"] for d in doc_list) else ("VERIFIED" if doc_list and all(d.get("status") == "VERIFIED" for d in doc_list) else "SCRUTINY_REQUIRED"),
        "conflict_status": conflict_data.get("status") if conflict_data else "CLEAR",
        "merit_score": merit_data.get("total_score") if merit_data else None,
        "institute_status": inst_data.get("status") if inst_data else "PENDING",
        "current_responsible_role": application.current_responsible_role or "SCRUTINY_OFFICER",
        "viewing_as_role": user_role,
        "next_recommended_action": "Review documents & run scrutiny" if application.current_state == "submitted" else f"Advance workflow stage from {application.current_state}",
    }

    return {
        "application": ApplicationRead.model_validate(application),
        "scheme": {
            "id": str(scheme.id),
            "code": scheme.code,
            "name": scheme.name,
            "description": scheme.description,
            "workflow_states": [ws.model_dump() for ws in scheme_config.workflow_states] if scheme_config else [],
            "required_documents": [rd.model_dump() for rd in scheme_config.required_documents] if scheme_config else [],
        } if scheme else None,
        "documents": doc_list,
        "eligibility_result": eligibility_result,
        "conflict": conflict_data,
        "merit": merit_data,
        "institute_verification": inst_data,
        "grievances": grievance_list,
        "audit_logs": audit_list,
        "available_transitions": available_transitions,
        "current_user_role": user_role,
        "sla": sla_data,
        "case_decision_summary": case_decision_summary,
    }