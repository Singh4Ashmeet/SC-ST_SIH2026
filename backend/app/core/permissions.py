"""
Centralized Permission System for Yojana Setu (SIH26239).

Defines permissions and role-to-permission mappings across the government scholarship workflow.
"""

from enum import Enum
from typing import Dict, Set
from app.models.user import UserRole


class Permission(str, Enum):
    # Application permissions
    APPLICATION_VIEW = "application.view"
    APPLICATION_VIEW_SENSITIVE = "application.view_sensitive"
    APPLICATION_UPDATE = "application.update"
    APPLICATION_ASSIGN = "application.assign"
    APPLICATION_ADVANCE_WORKFLOW = "application.advance_workflow"

    # Document permissions
    DOCUMENT_VIEW = "document.view"
    DOCUMENT_DOWNLOAD = "document.download"
    DOCUMENT_VERIFY = "document.verify"
    DOCUMENT_FLAG = "document.flag"
    DOCUMENT_REPROCESS = "document.reprocess"

    # Scrutiny permissions
    SCRUTINY_RUN = "scrutiny.run"
    SCRUTINY_RESOLVE = "scrutiny.resolve"

    # Merit permissions
    MERIT_VIEW = "merit.view"
    MERIT_EVALUATE = "merit.evaluate"

    # Selection permissions
    SELECTION_DECIDE = "selection.decide"

    # Conflict permissions
    CONFLICT_VIEW = "conflict.view"
    CONFLICT_RESOLVE = "conflict.resolve"

    # Institute permissions
    INSTITUTE_VERIFY = "institute.verify"

    # Grievance permissions
    GRIEVANCE_VIEW = "grievance.view"
    GRIEVANCE_MANAGE = "grievance.manage"
    GRIEVANCE_ESCALATE = "grievance.escalate"

    # Scheme permissions
    SCHEME_VIEW = "scheme.view"
    SCHEME_CREATE = "scheme.create"
    SCHEME_EDIT = "scheme.edit"
    SCHEME_PUBLISH = "scheme.publish"

    # Simulation permissions
    SIMULATION_CREATE = "simulation.create"
    SIMULATION_RUN = "simulation.run"
    SIMULATION_PUBLISH = "simulation.publish"

    # Audit & Reports
    AUDIT_VIEW = "audit.view"
    REPORTS_VIEW = "reports.view"


# Role to Permission Map
ROLE_PERMISSIONS: Dict[UserRole, Set[Permission]] = {
    UserRole.SUPER_ADMIN: set(Permission),  # Full permissions
    UserRole.SCHEME_ADMIN: {
        Permission.APPLICATION_VIEW,
        Permission.APPLICATION_VIEW_SENSITIVE,
        Permission.DOCUMENT_VIEW,
        Permission.MERIT_VIEW,
        Permission.MERIT_EVALUATE,
        Permission.CONFLICT_VIEW,
        Permission.GRIEVANCE_VIEW,
        Permission.GRIEVANCE_MANAGE,
        Permission.SCHEME_VIEW,
        Permission.SCHEME_CREATE,
        Permission.SCHEME_EDIT,
        Permission.SCHEME_PUBLISH,
        Permission.SIMULATION_CREATE,
        Permission.SIMULATION_RUN,
        Permission.SIMULATION_PUBLISH,
        Permission.AUDIT_VIEW,
        Permission.REPORTS_VIEW,
    },
    UserRole.SCRUTINY_OFFICER: {
        Permission.APPLICATION_VIEW,
        Permission.APPLICATION_VIEW_SENSITIVE,
        Permission.APPLICATION_UPDATE,
        Permission.APPLICATION_ADVANCE_WORKFLOW,
        Permission.DOCUMENT_VIEW,
        Permission.DOCUMENT_DOWNLOAD,
        Permission.DOCUMENT_VERIFY,
        Permission.DOCUMENT_FLAG,
        Permission.DOCUMENT_REPROCESS,
        Permission.SCRUTINY_RUN,
        Permission.SCRUTINY_RESOLVE,
        Permission.CONFLICT_VIEW,
        Permission.GRIEVANCE_VIEW,
        Permission.GRIEVANCE_MANAGE,
        Permission.REPORTS_VIEW,
    },
    UserRole.INSTITUTE_VERIFIER: {
        Permission.APPLICATION_VIEW,
        # Cannot view full sensitive financial data across all schemes
        Permission.DOCUMENT_VIEW,
        Permission.DOCUMENT_VERIFY,
        Permission.DOCUMENT_FLAG,
        Permission.INSTITUTE_VERIFY,
        Permission.APPLICATION_ADVANCE_WORKFLOW,
    },
    UserRole.SELECTION_COMMITTEE: {
        Permission.APPLICATION_VIEW,
        Permission.APPLICATION_VIEW_SENSITIVE,
        Permission.APPLICATION_ADVANCE_WORKFLOW,
        Permission.DOCUMENT_VIEW,
        Permission.MERIT_VIEW,
        Permission.MERIT_EVALUATE,
        Permission.SELECTION_DECIDE,
        Permission.CONFLICT_VIEW,
        Permission.CONFLICT_RESOLVE,
        Permission.REPORTS_VIEW,
    },
    UserRole.NODAL_OFFICER: {
        Permission.APPLICATION_VIEW,
        Permission.APPLICATION_VIEW_SENSITIVE,
        Permission.APPLICATION_ASSIGN,
        Permission.DOCUMENT_VIEW,
        Permission.SCRUTINY_RUN,
        Permission.CONFLICT_VIEW,
        Permission.GRIEVANCE_VIEW,
        Permission.GRIEVANCE_MANAGE,
        Permission.GRIEVANCE_ESCALATE,
        Permission.AUDIT_VIEW,
        Permission.REPORTS_VIEW,
    },
    UserRole.APPLICANT: {
        Permission.APPLICATION_VIEW,
        Permission.DOCUMENT_VIEW,
        Permission.DOCUMENT_VERIFY,
        Permission.GRIEVANCE_VIEW,
        Permission.GRIEVANCE_MANAGE,
    },
}


def has_permission(role: UserRole, permission: Permission) -> bool:
    """Check if a role possesses a specific permission."""
    return permission in ROLE_PERMISSIONS.get(role, set())
