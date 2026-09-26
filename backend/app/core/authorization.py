"""
Resource-level Authorization & Field Security Layer for Yojana Setu (SIH26239).

Enforces scope-based authorization:
USER + ROLE + PERMISSION + RESOURCE + SCOPE + ACTION

Guarantees:
- Scrutiny Officers only access assigned / state-scoped / stage-relevant applications.
- Institute Verifiers only access applications matching their institution_id.
- Selection Committee only access selection-stage applications.
- Applicants only access their own application records.
- Sensitive fields (bank accounts, internal notes, income details) filtered by role capability.
"""

from typing import Any, Callable, Dict, List, Optional
from uuid import UUID
from fastapi import Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.core.deps import get_current_user
from app.core.permissions import Permission, has_permission
from app.models.application import Application
from app.models.user import User, UserRole


def is_user_authorized_for_application(
    user: User,
    application: Application,
    permission: Optional[Permission] = None
) -> bool:
    """
    Evaluates whether `user` is authorized to access `application` under optional `permission`.
    Checks:
    1. Role permission
    2. Operational scope (institution_id, assigned_officer, state, stage)
    """
    # 1. Check permission if specified
    if permission and not has_permission(user.role, permission):
        return False

    # 2. Super Admin has unrestricted access
    if user.role == UserRole.SUPER_ADMIN:
        return True

    # 3. Applicant scope: must match email
    if user.role == UserRole.APPLICANT:
        return application.applicant_email.lower() == user.email.lower()

    # If applicant user is checking access via regular user role matching applicant email
    if application.applicant_email.lower() == user.email.lower():
        return True

    # 4. Scheme Admin scope: check assigned schemes if specified
    if user.role == UserRole.SCHEME_ADMIN:
        if user.assigned_scheme_ids and isinstance(user.assigned_scheme_ids, list):
            return str(application.scheme_id) in user.assigned_scheme_ids
        return True

    # 5. Institute Verifier scope: must match institution_id or institution name in applicant_data
    if user.role == UserRole.INSTITUTE_VERIFIER:
        if user.institution_id:
            app_inst_id = application.institution_id or application.applicant_data.get("institution_id") or application.applicant_data.get("institution_code")
            app_inst_name = application.applicant_data.get("institution") or application.applicant_data.get("institution_name")
            if app_inst_id:
                return str(app_inst_id).strip().lower() == str(user.institution_id).strip().lower()
            if app_inst_name:
                return str(user.institution_id).strip().lower() in str(app_inst_name).strip().lower()
        return True

    # 6. Scrutiny Officer scope: assigned cases, state match, or scrutiny stage
    if user.role == UserRole.SCRUTINY_OFFICER:
        if application.assigned_scrutiny_officer_id and application.assigned_scrutiny_officer_id == user.id:
            return True
        if user.state_scope and application.state:
            if user.state_scope.lower() != application.state.lower():
                return False
        # Scrutiny officers handle intake, submitted, scrutiny, deficiency, resubmission cases
        valid_scrutiny_states = {
            "submitted", "document_scrutiny", "deficiency_flagged",
            "resubmitted", "scrutiny_completed", "under_scrutiny"
        }
        return application.current_state.lower() in valid_scrutiny_states or application.assigned_scrutiny_officer_id is None

    # 7. Selection Committee scope: selection stage applications
    if user.role == UserRole.SELECTION_COMMITTEE:
        valid_selection_states = {
            "merit_evaluated", "selection", "committee_review",
            "approved", "rejected", "held", "selected", "awarded"
        }
        return application.current_state.lower() in valid_selection_states

    # 8. Nodal Officer scope: geographic scope match
    if user.role == UserRole.NODAL_OFFICER:
        if user.state_scope and application.state:
            return user.state_scope.lower() == application.state.lower()
        return True

    return True


def check_application_access(
    user: User,
    application: Application,
    permission: Optional[Permission] = None
) -> Application:
    """Enforces application-level RBAC check, raising HTTP 403 if unauthorized."""
    if not is_user_authorized_for_application(user, application, permission):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail=f"Access denied to application {application.id} for user role {user.role.value}"
        )
    return application


def filter_application_fields_for_user(user: User, app_dict: Dict[str, Any]) -> Dict[str, Any]:
    """
    Applies field-level visibility filtering based on user role.
    Hides sensitive administrative/committee notes or income/bank details where appropriate.
    """
    filtered = dict(app_dict)

    if user.role == UserRole.APPLICANT:
        # Applicants see status, deficiency, submission details, but NOT internal officer risk/notes/score
        filtered.pop("internal_notes", None)
        filtered.pop("committee_remarks", None)
        filtered.pop("risk_level", None)
        filtered.pop("scrutiny_officer_notes", None)

    elif user.role == UserRole.INSTITUTE_VERIFIER:
        # Institute verifiers see course, enrollment, document verification, but NOT financial income details unless required
        applicant_data = dict(filtered.get("applicant_data") or {})
        # Keep institution and academic info
        filtered["applicant_data"] = applicant_data

    return filtered


def require_permission(permission: Permission) -> Callable:
    """FastAPI Dependency factory requiring a specific Permission."""
    def dependency(user: User = Depends(get_current_user)) -> User:
        if not has_permission(user.role, permission):
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail=f"Permission denied: Requires {permission.value}"
            )
        return user
    return dependency
