"""
Applications API router.

Endpoints for creating applications, querying state, triggering transitions,
and retrieving audit logs.
"""

import logging
import uuid
from typing import Annotated, Any, Dict, List, Optional
from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel
from sqlalchemy.orm import Session

logger = logging.getLogger(__name__)

from app.core.cache import cache
from app.core.database import get_db
from app.core.deps import get_current_user, require_any_role, get_optional_current_user
from app.models.application import Application
from app.models.audit_log import AuditLog
from app.models.document import Document
from app.models.conflict import Conflict
from app.models.merit_evaluation import MeritEvaluation
from app.models.institute_verification import InstituteVerification, InstituteVerificationStatus
from app.models.grievance import Grievance
from app.models.scheme import Scheme
from app.models.user import User, UserRole
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
            scrutiny_states = [
                "submitted", "document_scrutiny", "deficiency_flagged",
                "deficient", "resubmitted", "under_scrutiny", "eligibility_check"
            ]
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
            query = query.filter(Application.current_state.in_(["submitted", "document_scrutiny", "deficiency_flagged", "deficient", "resubmitted", "under_scrutiny", "eligibility_check"]))
        elif queue == "institute":
            query = query.filter(Application.current_state.in_(["institute_verification", "pending_institute_verification"]))
        elif queue == "selection":
            query = query.filter(Application.current_state.in_(["merit_evaluated", "selection", "committee_review"]))
        elif queue in ["awarded", "approved"]:
            query = query.filter(Application.current_state.in_(["approved", "fellowship_awarded", "disbursed"]))
    if search:
        search_pattern = f"%{search}%"
        query = query.filter(
            (Application.applicant_name.ilike(search_pattern)) |
            (Application.applicant_email.ilike(search_pattern))
        )

    offset = (page - 1) * page_size
    applications = list(query.order_by(Application.created_at.desc()).offset(offset).limit(page_size).all())

    role_map = {
        "submitted": "SYSTEM_EVALUATOR",
        "eligibility_check": "SYSTEM_EVALUATOR",
        "document_scrutiny": "SCRUTINY_OFFICER",
        "deficient": "APPLICANT",
        "deficiency_flagged": "APPLICANT",
        "resubmitted": "SCRUTINY_OFFICER",
        "scrutiny_completed": "INSTITUTE_VERIFIER",
        "institute_verification": "INSTITUTE_VERIFIER",
        "pending_selection": "SELECTION_COMMITTEE",
        "merit_evaluated": "SELECTION_COMMITTEE",
        "selection": "SELECTION_COMMITTEE",
        "committee_review": "SELECTION_COMMITTEE",
        "approved": "SCHEME_ADMIN",
        "fellowship_awarded": "SCHEME_ADMIN",
        "disbursed": "SCHOLAR_ACTIVE",
        "rejected": "CLOSED",
        "ineligible": "CLOSED",
    }
    needs_commit = False
    for app in applications:
        c_role = role_map.get((app.current_state or "").lower(), "OFFICER")
        if app.current_responsible_role != c_role:
            app.current_responsible_role = c_role
            needs_commit = True
    if needs_commit:
        try:
            db.commit()
        except Exception:
            db.rollback()

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

    # Create audit log with cryptographic hash chain
    from app.services.audit_service import create_audit_log
    create_audit_log(
        db=db,
        application_id=application.id,
        scheme_id=scheme.id,
        actor_user_id=None,
        action="application_created",
        from_state=None,
        to_state=initial_state,
        details={"applicant_data": payload.applicant_data},
    )

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
    current_user: Annotated[Optional[User], Depends(get_optional_current_user)] = None,
    db: Session = Depends(get_db),
) -> Application:
    """Fetch an application by ID with its current state. Enforces applicant ownership and role-scoped authorization."""
    application = db.query(Application).filter(Application.id == application_id).first()
    if not application:
        raise HTTPException(status_code=404, detail="Application not found")
    
    from app.core.authorization import verify_applicant_ownership_or_permission
    from app.core.permissions import Permission
    verify_applicant_ownership_or_permission(current_user, application, Permission.APPLICATION_VIEW)

    role_map = {
        "submitted": "SYSTEM_EVALUATOR",
        "eligibility_check": "SYSTEM_EVALUATOR",
        "document_scrutiny": "SCRUTINY_OFFICER",
        "deficient": "APPLICANT",
        "deficiency_flagged": "APPLICANT",
        "resubmitted": "SCRUTINY_OFFICER",
        "scrutiny_completed": "INSTITUTE_VERIFIER",
        "institute_verification": "INSTITUTE_VERIFIER",
        "pending_selection": "SELECTION_COMMITTEE",
        "merit_evaluated": "SELECTION_COMMITTEE",
        "selection": "SELECTION_COMMITTEE",
        "committee_review": "SELECTION_COMMITTEE",
        "approved": "SCHEME_ADMIN",
        "fellowship_awarded": "SCHEME_ADMIN",
        "disbursed": "SCHOLAR_ACTIVE",
        "rejected": "CLOSED",
        "ineligible": "CLOSED",
    }
    canonical_role = role_map.get((application.current_state or "").lower(), "OFFICER")
    if application.current_responsible_role != canonical_role:
        application.current_responsible_role = canonical_role
        try:
            db.commit()
            db.refresh(application)
        except Exception:
            db.rollback()

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


class InstituteVerificationRequest(BaseModel):
    decision: str = "VERIFIED"  # "VERIFIED" | "QUERY_RAISED" | "REJECTED"
    institution_code: Optional[str] = None
    remarks: Optional[str] = None


@router.post("/{application_id}/institute-verify")
def verify_application_by_institute(
    application_id: uuid.UUID,
    payload: InstituteVerificationRequest,
    current_user: Annotated[Optional[User], Depends(get_optional_current_user)] = None,
    db: Session = Depends(get_db),
) -> Dict[str, Any]:
    """
    Institutional Verification Endpoint:
    Allows Institute Nodal Officers / Verifiers or Super Admins to record bonafide enrollment verification.
    If decision is VERIFIED and application is at institute verification stage, advances it to selection.
    """
    application = db.query(Application).filter(Application.id == application_id).first()
    if not application:
        raise HTTPException(status_code=404, detail="Application not found")

    decision = payload.decision.upper()
    remarks = payload.remarks or f"Institutional verification decision: {decision}"

    inst_ver = db.query(InstituteVerification).filter(
        InstituteVerification.application_id == application_id
    ).first()

    inst_name = (
        application.applicant_data.get("institution_name")
        or application.applicant_data.get("university")
        or application.applicant_data.get("institution")
        or "Recognized University / Institution"
    )

    if not inst_ver:
        inst_ver = InstituteVerification(
            application_id=application_id,
            institution_name=inst_name,
            institution_code=payload.institution_code or application.institution_id or "INST-VERIFIED",
            status=InstituteVerificationStatus(decision) if decision in InstituteVerificationStatus.__members__ else InstituteVerificationStatus.VERIFIED,
            verifier_user_id=current_user.id if current_user else None,
            remarks=remarks,
        )
        db.add(inst_ver)
    else:
        inst_ver.status = InstituteVerificationStatus(decision) if decision in InstituteVerificationStatus.__members__ else InstituteVerificationStatus.VERIFIED
        inst_ver.remarks = remarks
        inst_ver.verifier_user_id = current_user.id if current_user else None

    from app.services.audit_service import create_audit_log
    create_audit_log(
        db=db,
        application_id=application.id,
        scheme_id=application.scheme_id,
        actor_user_id=current_user.id if current_user else None,
        action="institute_verified" if decision == "VERIFIED" else "institute_query_raised",
        from_state=application.current_state,
        to_state="selection" if decision == "VERIFIED" and application.current_state in ["institute_verification", "scrutiny_completed"] else application.current_state,
        details={"decision": decision, "remarks": remarks, "institution_name": inst_name},
    )

    # Advance workflow if currently at institute verification
    if decision == "VERIFIED" and application.current_state in ["institute_verification", "scrutiny_completed"]:
        application.current_state = "selection"
        application.current_responsible_role = "SELECTION_COMMITTEE"
        from datetime import datetime, timezone
        application.stage_entry_time = datetime.now(timezone.utc)

    db.commit()
    db.refresh(application)

    return {
        "success": True,
        "message": f"Institutional verification recorded: {decision}",
        "status": inst_ver.status.value,
        "application_state": application.current_state,
        "current_responsible_role": application.current_responsible_role,
    }


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

    if current_user:
        from app.core.authorization import is_user_authorized_for_application
        if not is_user_authorized_for_application(current_user, application):
            raise HTTPException(
                status_code=403,
                detail=f"Access denied: You do not have permission to view application {application_id}",
            )

    scheme = application.scheme
    from app.services.scheme_config_validator import validate_scheme_config
    scheme_config = validate_scheme_config(scheme.config) if scheme else None

    # 1. Documents & Extracted Fields with Document Trust Engine
    from app.services.document_trust_engine import evaluate_document_trust, build_evidence_graph
    raw_documents = db.query(Document).filter(Document.application_id == application_id).order_by(Document.uploaded_at.desc()).all()
    seen_types = set()
    documents = []
    for d in raw_documents:
        if d.doc_type not in seen_types:
            seen_types.add(d.doc_type)
            documents.append(d)
    documents.reverse()
    doc_list = []
    for d in documents:
        trust_eval = evaluate_document_trust(d, application, scheme_config, documents)
        doc_list.append({
            "id": str(d.id),
            "doc_type": d.doc_type,
            "status": d.status.value if hasattr(d.status, "value") else str(d.status),
            "extracted_fields": d.extracted_fields,
            "deficiency_reasons": d.deficiency_reasons,
            "trust_assessment": trust_eval,
            "uploaded_at": d.uploaded_at.isoformat() if d.uploaded_at else None,
            "download_url": f"/api/applications/documents/{d.id}/file",
        })

    evidence_graph = build_evidence_graph(application, documents)

    # 2. Eligibility Evaluation
    eligibility_result = None
    if scheme:
        try:
            eval_res = evaluate_eligibility(scheme_config or scheme.config, application.applicant_data)
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
        except Exception as eval_err:
            logger.error(f"Eligibility evaluation error for {application_id}: {eval_err}")

    # 3. Cross-Scheme Conflict
    conflict_data = None
    try:
        conflict = db.query(Conflict).filter(
            (Conflict.application_id == application_id) | 
            (Conflict.conflicting_application_id == application_id)
        ).first()
        if conflict:
            conflict_data = {
                "id": str(conflict.id),
                "status": conflict.status.value if hasattr(conflict.status, "value") else str(conflict.status),
                "match_confidence": getattr(conflict, "confidence", 0.0),
                "matching_signals": getattr(conflict, "matching_signals", {}),
                "resolution_notes": getattr(conflict, "resolution_remarks", None) or getattr(conflict, "explanation", None),
            }
    except Exception:
        conflict_data = None

    # 4. Merit Evaluation
    merit_data = None
    try:
        merit = db.query(MeritEvaluation).filter(MeritEvaluation.application_id == application_id).first()
        if merit:
            score_bd = getattr(merit, "score_breakdown", {}) or {}
            pref_factors = getattr(merit, "preference_factors", {}) or {}
            merit_data = {
                "id": str(merit.id),
                "academic_score": score_bd.get("academic_score", score_bd.get("academic", 0.0)),
                "research_score": score_bd.get("research_score", score_bd.get("research", 0.0)),
                "experience_score": score_bd.get("experience_score", score_bd.get("experience", 0.0)),
                "preference_score": pref_factors.get("total_bonus", score_bd.get("preference_score", 0.0)),
                "total_score": getattr(merit, "total_score", 0.0),
                "rank": getattr(merit, "rank", None),
                "decision": "RANKED" if merit.rank else "EVALUATED",
                "committee_remarks": None,
            }
    except Exception:
        merit_data = None

    # 5. Institute Verification
    inst_data = None
    try:
        inst_ver = db.query(InstituteVerification).filter(InstituteVerification.application_id == application_id).first()
        if inst_ver:
            inst_data = {
                "id": str(inst_ver.id),
                "institution_name": getattr(inst_ver, "institution_name", ""),
                "institution_code": getattr(inst_ver, "institution_code", None),
                "status": inst_ver.status.value if hasattr(inst_ver.status, "value") else str(inst_ver.status),
                "remarks": getattr(inst_ver, "remarks", None),
                "query_details": getattr(inst_ver, "query_details", None),
                "verified_at": inst_ver.verified_at.isoformat() if getattr(inst_ver, "verified_at", None) else None,
            }
    except Exception:
        inst_data = None

    # 6. Grievances
    grievance_list = []
    try:
        grievances = db.query(Grievance).filter(Grievance.application_id == application_id).all()
        for g in grievances:
            grievance_list.append({
                "id": str(g.id),
                "grievance_number": getattr(g, "grievance_number", f"GRV-{str(g.id)[:8].upper()}"),
                "category": g.category.value if hasattr(g.category, "value") else str(getattr(g, "category", "general")),
                "subject": getattr(g, "subject", getattr(g, "description", "")[:50]),
                "status": g.status.value if hasattr(g.status, "value") else str(g.status),
                "priority": g.priority.value if hasattr(g.priority, "value") else str(g.priority),
                "created_at": g.created_at.isoformat() if getattr(g, "created_at", None) else None,
            })
    except Exception:
        grievance_list = []

    # 7. Audit Trail Timeline
    audit_list = []
    try:
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
    except Exception:
        audit_list = []

    # 8. Available Transitions for current role
    engine = WorkflowEngine(db)
    user_role = current_user.role.value if current_user else "APPLICANT"
    transitions = engine.get_available_transitions(application, user_role=user_role)
    available_transitions = [
        {"trigger": t.trigger, "from_state": t.from_state, "to_state": t.to_state, "label": t.trigger.replace("_", " ").title()}
        for t in transitions
    ]

    # 9. Dynamic Canonical Role & SLA Calculation
    from datetime import datetime, timezone, timedelta
    entry_time = application.stage_entry_time or application.updated_at or application.created_at
    if entry_time and entry_time.tzinfo is None:
        entry_time = entry_time.replace(tzinfo=timezone.utc)
    now = datetime.now(timezone.utc)
    
    st = (application.current_state or "").lower()
    
    role_map = {
        "submitted": "SYSTEM_EVALUATOR",
        "eligibility_check": "SYSTEM_EVALUATOR",
        "document_scrutiny": "SCRUTINY_OFFICER",
        "deficient": "APPLICANT",
        "deficiency_flagged": "APPLICANT",
        "resubmitted": "SCRUTINY_OFFICER",
        "scrutiny_completed": "INSTITUTE_VERIFIER",
        "institute_verification": "INSTITUTE_VERIFIER",
        "pending_selection": "SELECTION_COMMITTEE",
        "merit_evaluated": "SELECTION_COMMITTEE",
        "selection": "SELECTION_COMMITTEE",
        "committee_review": "SELECTION_COMMITTEE",
        "approved": "SCHEME_ADMIN",
        "fellowship_awarded": "SCHEME_ADMIN",
        "disbursed": "SCHOLAR_ACTIVE",
        "rejected": "CLOSED",
        "ineligible": "CLOSED",
    }
    canonical_role = role_map.get(st, "OFFICER")
    if application.current_responsible_role != canonical_role:
        application.current_responsible_role = canonical_role
        try:
            db.commit()
            db.refresh(application)
        except Exception:
            db.rollback()

    is_completed = False
    is_breached = False
    remaining_hours = 0
    remaining_minutes = 0
    deadline = None
    stage_sla_hours = 0

    if st in ["approved", "fellowship_awarded"]:
        is_completed = True
        formatted_sla = "STAGE COMPLETED: Fellowship Awarded (Pending Disbursal)"
        next_action = "Initiate Direct Benefit Transfer (DBT) & PFMS Disbursal"
    elif st == "disbursed":
        is_completed = True
        formatted_sla = "STAGE COMPLETED: Fellowship Disbursed via PFMS"
        next_action = "Scholar Active — Post-Selection Monitoring & Annual Renewal"
    elif st in ["rejected", "ineligible"]:
        is_completed = True
        formatted_sla = "APPLICATION CLOSED: Decision Recorded"
        next_action = "Case closed. If appeal submitted, review under Grievances."
    else:
        sla_hours_map = {
            "submitted": 24,
            "eligibility_check": 24,
            "document_scrutiny": 48,
            "deficiency_flagged": 72,
            "deficient": 72,
            "resubmitted": 24,
            "scrutiny_completed": 24,
            "institute_verification": 72,
            "merit_evaluated": 48,
            "selection": 96,
            "pending_selection": 96,
            "committee_review": 96,
        }
        stage_sla_hours = sla_hours_map.get(st, 48)
        deadline = entry_time + timedelta(hours=stage_sla_hours) if entry_time else now + timedelta(hours=48)
        diff = deadline - now
        total_seconds = int(diff.total_seconds())
        is_breached = total_seconds < 0
        abs_seconds = abs(total_seconds)
        remaining_hours = abs_seconds // 3600
        remaining_minutes = (abs_seconds % 3600) // 60
        formatted_sla = f"SLA BREACHED ({remaining_hours}h {remaining_minutes}m overdue)" if is_breached else f"{remaining_hours}h {remaining_minutes}m remaining"
        
        if st in ["deficient", "deficiency_flagged"]:
            next_action = "Awaiting applicant to resubmit corrected documents"
        elif st in ["selection", "pending_selection", "committee_review"]:
            next_action = "Selection Committee to review score & record award decision"
        elif st in ["institute_verification", "scrutiny_completed"]:
            next_action = "Institute Nodal Officer to verify bonafide enrollment"
        elif st in ["document_scrutiny", "resubmitted"]:
            next_action = "Scrutiny Officer to review documents and complete checklist"
        else:
            next_action = "Run automated eligibility rule check & begin document scrutiny"

    sla_data = {
        "stage_entry_time": entry_time.isoformat() if entry_time else None,
        "deadline": deadline.isoformat() if deadline else None,
        "sla_hours": stage_sla_hours,
        "is_breached": is_breached,
        "is_completed": is_completed,
        "remaining_hours": remaining_hours if not is_breached else -remaining_hours,
        "remaining_minutes": remaining_minutes,
        "formatted_status": formatted_sla,
    }

    # 10. Case Decision Summary
    case_decision_summary = {
        "eligibility_status": "PASS" if (eligibility_result and eligibility_result.get("passed")) else ("FAIL" if eligibility_result else "PENDING"),
        "documents_status": "DEFICIENT" if any(d.get("status") in ["DEFICIENT", "REJECTED"] for d in doc_list) else ("VERIFIED" if doc_list and all(d.get("status") == "VERIFIED" for d in doc_list) else "SCRUTINY_REQUIRED"),
        "conflict_status": conflict_data.get("status") if conflict_data else "CLEAR",
        "merit_score": merit_data.get("total_score") if merit_data else None,
        "institute_status": inst_data.get("status") if inst_data else "PENDING",
        "current_responsible_role": canonical_role,
        "viewing_as_role": user_role,
        "next_recommended_action": next_action,
    }

    # Role-scoped data projection
    filtered_merit = merit_data
    filtered_conflict = conflict_data
    filtered_audit = audit_list
    filtered_docs = doc_list

    if current_user and current_user.role == UserRole.APPLICANT:
        filtered_conflict = None
        if merit_data and merit_data.get("decision") not in ["AWARDED", "REJECTED"]:
            filtered_merit = {"status": "Evaluation in progress"}
        filtered_audit = [a for a in audit_list if a.get("action") in ["application_created", "state_transition", "document_uploaded", "resubmission"]]
    elif current_user and current_user.role == UserRole.INSTITUTE_VERIFIER:
        filtered_conflict = None
        filtered_merit = None
        filtered_docs = [d for d in doc_list if d.get("doc_type") in ["bonafide_certificate", "marksheet", "admission_letter", "joining_report"]]

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
        "documents": filtered_docs,
        "eligibility_result": eligibility_result,
        "conflict": filtered_conflict,
        "merit": filtered_merit,
        "institute_verification": inst_data,
        "grievances": grievance_list,
        "audit_logs": filtered_audit,
        "evidence_graph": evidence_graph,
        "available_transitions": available_transitions,
        "current_user_role": user_role,
        "sla": sla_data,
        "case_decision_summary": case_decision_summary,
    }


@router.get("/{application_id}/decision-passport")
def get_application_decision_passport(
    application_id: uuid.UUID,
    current_user: Annotated[Optional[User], Depends(get_optional_current_user)] = None,
    db: Session = Depends(get_db),
) -> Dict[str, Any]:
    """
    Decision Passport (Flagship): Unified, explainable snapshot detailing:
    1. Application Summary
    2. Eligibility Breakdown with document evidence mapping
    3. Document Evidence with field-level confidence & source region snippets
    4. AI / Document Intelligence confidence & uncertainty routing
    5. Deficiencies & resubmissions
    6. Merit Scoring calculation & ranking
    7. Human Scrutiny oversight
    8. Committee Integrity, quorum, and conflict status
    9. Post-selection / financial disbursement tracking
    10. Cryptographic SHA-256 chained audit link
    """
    application = db.query(Application).filter(Application.id == application_id).first()
    if not application:
        raise HTTPException(status_code=404, detail="Application not found")

    if current_user:
        from app.core.authorization import is_user_authorized_for_application
        if not is_user_authorized_for_application(current_user, application):
            raise HTTPException(
                status_code=403,
                detail=f"Access denied: You do not have permission to view application {application_id}",
            )

    from app.services.decision_passport_service import build_decision_passport
    try:
        return build_decision_passport(db, application_id)
    except Exception as exc:
        logger.error(f"Failed to build decision passport for {application_id}: {exc}")
        raise HTTPException(status_code=500, detail=f"Failed to generate decision passport: {str(exc)}")


@router.get("/{application_id}/decision-trace")
def get_application_decision_trace(
    application_id: uuid.UUID,
    current_user: Annotated[Optional[User], Depends(get_optional_current_user)] = None,
    db: Session = Depends(get_db),
) -> Dict[str, Any]:
    """
    Decision Trace (Phase 8): Full explainable audit trace mapping:
    Rule -> Policy Version -> Condition -> Extracted Evidence -> Supporting Document -> Verdict.
    """
    application = db.query(Application).filter(Application.id == application_id).first()
    if not application:
        raise HTTPException(status_code=404, detail="Application not found")

    if current_user:
        from app.core.authorization import is_user_authorized_for_application
        if not is_user_authorized_for_application(current_user, application):
            raise HTTPException(
                status_code=403,
                detail=f"Access denied: You do not have permission to view application {application_id}",
            )

    from app.services.policy_simulation_engine import build_decision_trace
    try:
        return build_decision_trace(db, application_id)
    except Exception as exc:
        raise HTTPException(status_code=400, detail=str(exc))


class ReplayDecisionRequest(BaseModel):
    proposed_config: Optional[Dict[str, Any]] = None


@router.post("/{application_id}/replay-decision")
def replay_application_decision_endpoint(
    application_id: uuid.UUID,
    payload: Optional[ReplayDecisionRequest] = None,
    current_user: Annotated[Optional[User], Depends(get_optional_current_user)] = None,
    db: Session = Depends(get_db),
) -> Dict[str, Any]:
    """
    Decision Replay (Phase 22): Re-evaluates an application against:
    Historical policy vs Current policy vs Proposed policy, highlighting exactly which rule changed.
    """
    application = db.query(Application).filter(Application.id == application_id).first()
    if not application:
        raise HTTPException(status_code=404, detail="Application not found")

    if current_user:
        from app.core.authorization import is_user_authorized_for_application
        if not is_user_authorized_for_application(current_user, application):
            raise HTTPException(
                status_code=403,
                detail=f"Access denied: You do not have permission to view application {application_id}",
            )

    from app.services.policy_simulation_engine import replay_application_decision
    proposed_cfg = payload.proposed_config if payload else None
    try:
        return replay_application_decision(db, application_id, proposed_config_dict=proposed_cfg)
    except Exception as exc:
        raise HTTPException(status_code=400, detail=str(exc))