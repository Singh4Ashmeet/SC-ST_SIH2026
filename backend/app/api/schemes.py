"""
Schemes API router.

Provides CRUD operations for Scheme entities with validation,
audit logging, and role-based access control.
"""

from typing import Annotated, Any, Dict, List, Optional
from uuid import UUID

from fastapi import APIRouter, Body, Depends, HTTPException, Query, status
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.core.cache import cache
from app.core.database import get_db
from app.core.deps import (
    get_current_user,
    require_any_role,
    require_scheme_admin,
)
from app.models.audit_log import AuditLog
from app.models.scheme import Scheme
from app.models.user import User
from app.schemas.scheme import SchemeCreate, SchemeRead, SchemeUpdate
from app.schemas.scheme_config import SchemeConfigValidationError
from app.services.scheme_config_validator import validate_scheme_config


router = APIRouter(prefix="/schemes", tags=["Schemes"])


def _format_validation_error(exc: SchemeConfigValidationError) -> Dict[str, Any]:
    """Format a validation error into the standard response shape."""
    return {"valid": False, "errors": exc.errors}


def _create_audit_log(
    db: Session,
    *,
    action: str,
    scheme_id: UUID,
    actor_user_id: UUID,
    details: Optional[Dict[str, Any]] = None,
) -> AuditLog:
    """Create and persist an audit log entry with cryptographic hash chain."""
    from app.services.audit_service import create_audit_log
    audit_log = create_audit_log(
        db=db,
        scheme_id=scheme_id,
        actor_user_id=actor_user_id,
        action=action,
        details=details or {},
    )
    db.flush()
    return audit_log


def _check_existing_applications_in_removed_states(
    db: Session,
    scheme_id: UUID,
    new_config: Dict[str, Any],
) -> List[str]:
    """
    Check if there are existing applications in states that don't exist in the new config.
    
    Returns a list of warning messages (empty if no issues).
    """
    from app.models.application import Application
    from app.services.workflow_engine import build_state_machine
    
    # Get all applications for this scheme
    applications = db.execute(
        select(Application).where(Application.scheme_id == scheme_id)
    ).scalars().all()
    
    if not applications:
        return []
    
    # Build state machine from new config to get valid states
    try:
        validated_config = validate_scheme_config(new_config)
        valid_states = {s.name for s in validated_config.workflow_states}
    except Exception:
        # If config validation fails, we can't check - but the update will fail anyway
        return []
    
    # Find applications in states that no longer exist
    warnings = []
    for app in applications:
        if app.current_state not in valid_states:
            warnings.append(
                f"Application {app.id} is in state '{app.current_state}' "
                f"which does not exist in the new configuration"
            )
    
    return warnings


@router.post("/validate-config")
def validate_config(
    payload: Dict[str, Any] = Body(...),
    _current_user: Annotated[User, Depends(require_scheme_admin)] = None
) -> Dict[str, Any]:
    """Validate a scheme configuration JSON document against domain rules.

    Requires SUPER_ADMIN or SCHEME_ADMIN role.

    Accepts raw JSON body and always returns HTTP 200:
      - Valid:   {"valid": True, "config": <parsed_model>}
      - Invalid: {"valid": False, "errors": [<error_strings>]}
    """
    try:
        config = validate_scheme_config(payload)
        return {
            "valid": True,
            "config": config.model_dump(),
        }
    except SchemeConfigValidationError as exc:
        return {
            "valid": False,
            "errors": exc.errors,
        }
    except Exception as exc:
        return {
            "valid": False,
            "errors": [str(exc)],
        }


@router.post("", response_model=SchemeRead, status_code=status.HTTP_201_CREATED)
def create_scheme(
    payload: SchemeCreate,
    current_user: Annotated[User, Depends(require_scheme_admin)],
    db: Session = Depends(get_db)
) -> Scheme:
    """Create a new scheme with validated configuration.

    Requires SUPER_ADMIN or SCHEME_ADMIN role.
    Validates the config before saving.
    Returns 422 if config is invalid, 409 if scheme code already exists.
    """
    # Validate the config first
    try:
        validated_config = validate_scheme_config(payload.config)
    except SchemeConfigValidationError as exc:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail=_format_validation_error(exc)
        ) from exc
    except Exception as exc:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail={"valid": False, "errors": [str(exc)]}
        ) from exc

    # Check for duplicate scheme code
    existing = db.execute(
        select(Scheme).where(Scheme.code == payload.code)
    ).scalar_one_or_none()
    if existing:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=f"Scheme with code '{payload.code}' already exists"
        )

    # Create the scheme
    scheme = Scheme(
        code=payload.code,
        name=payload.name,
        description=payload.description,
        config=validated_config.model_dump(),
        is_active=payload.is_active,
        created_by=current_user.id,
    )
    db.add(scheme)
    db.flush()

    # Create audit log
    _create_audit_log(
        db,
        action="scheme_created",
        scheme_id=scheme.id,
        actor_user_id=current_user.id,
        details={"config_version": validated_config.version},
    )

    db.commit()
    db.refresh(scheme)
    cache.clear_prefix("schemes:")
    return scheme


@router.get("", response_model=List[SchemeRead])
def list_schemes(
    is_active: Optional[bool] = Query(None, description="Filter by active status"),
    db: Session = Depends(get_db)
) -> List[Scheme]:
    """List all schemes, optionally filtered by is_active.

    Publicly accessible to allow students/applicants to view available schemes.
    """
    cache_key = f"schemes:list:{is_active}"
    cached = cache.get(cache_key)
    if cached is not None:
        return cached

    query = select(Scheme)
    if is_active is not None:
        query = query.where(Scheme.is_active == is_active)
    schemes = list(db.execute(query).scalars().all())
    cache.set(cache_key, schemes, ttl=30)
    return schemes


@router.get("/{scheme_id}", response_model=SchemeRead)
def get_scheme(
    scheme_id: UUID,
    db: Session = Depends(get_db)
) -> Scheme:
    """Fetch a scheme by ID.

    Publicly accessible to allow students/applicants to view scheme details.
    Returns 404 if not found.
    """
    scheme = db.execute(
        select(Scheme).where(Scheme.id == scheme_id)
    ).scalar_one_or_none()
    if not scheme:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Scheme with id '{scheme_id}' not found"
        )
    return scheme


@router.get("/by-code/{code}", response_model=SchemeRead)
def get_scheme_by_code(
    code: str,
    db: Session = Depends(get_db)
) -> Scheme:
    """Fetch a scheme by code.

    Publicly accessible to allow workflow/eligibility engine lookups.
    Returns 404 if not found.
    """
    scheme = db.execute(
        select(Scheme).where(Scheme.code == code)
    ).scalar_one_or_none()
    if not scheme:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Scheme with code '{code}' not found"
        )
    return scheme


@router.patch("/{scheme_id}", response_model=SchemeRead)
def update_scheme(
    scheme_id: UUID,
    payload: SchemeUpdate,
    current_user: Annotated[User, Depends(require_scheme_admin)],
    db: Session = Depends(get_db)
) -> Scheme:
    """Partially update a scheme.

    Requires SUPER_ADMIN or SCHEME_ADMIN role.
    If config is updated, re-validates and bumps version.
    Warns (but doesn't block) if existing applications are in states
    that no longer exist in the new config.
    """
    scheme = db.execute(
        select(Scheme).where(Scheme.id == scheme_id)
    ).scalar_one_or_none()
    if not scheme:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Scheme with id '{scheme_id}' not found"
        )

    # Track changed fields for audit log
    changed_fields = []

    # Update simple fields
    if payload.name is not None and payload.name != scheme.name:
        scheme.name = payload.name
        changed_fields.append("name")
    if payload.description is not None and payload.description != scheme.description:
        scheme.description = payload.description
        changed_fields.append("description")
    if payload.is_active is not None and payload.is_active != scheme.is_active:
        scheme.is_active = payload.is_active
        changed_fields.append("is_active")

    # Handle config update with validation
    config_warnings = []
    if payload.config is not None:
        try:
            validated_config = validate_scheme_config(payload.config)
        except SchemeConfigValidationError as exc:
            raise HTTPException(
                status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
                detail=_format_validation_error(exc)
            ) from exc
        except Exception as exc:
            raise HTTPException(
                status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
                detail={"valid": False, "errors": [str(exc)]}
            ) from exc

        # Check for applications in states that will be removed
        config_warnings = _check_existing_applications_in_removed_states(
            db, scheme_id, validated_config.model_dump()
        )

        # Bump version
        current_version = scheme.config.get("version", 1)
        new_version = current_version + 1
        config_dict = validated_config.model_dump()
        config_dict["version"] = new_version
        
        scheme.config = config_dict
        changed_fields.append("config")
        changed_fields.append(f"version: {current_version} -> {new_version}")

    if not changed_fields:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="No changes provided"
        )

    # Create audit log
    _create_audit_log(
        db,
        action="scheme_updated",
        scheme_id=scheme.id,
        actor_user_id=current_user.id,
        details={
            "changed_fields": changed_fields,
            "warnings": config_warnings,
        },
    )

    db.commit()
    db.refresh(scheme)
    return scheme


@router.post("/{scheme_id}/deactivate", response_model=SchemeRead)
def deactivate_scheme(
    scheme_id: UUID,
    current_user: Annotated[User, Depends(require_scheme_admin)],
    db: Session = Depends(get_db)
) -> Scheme:
    """Deactivate a scheme (set is_active=False).

    Requires SUPER_ADMIN or SCHEME_ADMIN role.
    """
    scheme = db.execute(
        select(Scheme).where(Scheme.id == scheme_id)
    ).scalar_one_or_none()
    if not scheme:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Scheme with id '{scheme_id}' not found"
        )

    if not scheme.is_active:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Scheme is already inactive"
        )

    scheme.is_active = False

    _create_audit_log(
        db,
        action="scheme_deactivated",
        scheme_id=scheme.id,
        actor_user_id=current_user.id,
    )

    db.commit()
    db.refresh(scheme)
    return scheme


@router.post("/{scheme_id}/activate", response_model=SchemeRead)
def activate_scheme(
    scheme_id: UUID,
    current_user: Annotated[User, Depends(require_scheme_admin)],
    db: Session = Depends(get_db)
) -> Scheme:
    """Activate a scheme (set is_active=True).

    Requires SUPER_ADMIN or SCHEME_ADMIN role.
    """
    scheme = db.execute(
        select(Scheme).where(Scheme.id == scheme_id)
    ).scalar_one_or_none()
    if not scheme:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Scheme with id '{scheme_id}' not found"
        )

    if scheme.is_active:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Scheme is already active"
        )

    scheme.is_active = True

    _create_audit_log(
        db,
        action="scheme_activated",
        scheme_id=scheme.id,
        actor_user_id=current_user.id,
    )

    db.commit()
    db.refresh(scheme)
    return scheme