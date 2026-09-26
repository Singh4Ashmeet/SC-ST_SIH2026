"""
Policy Simulation API routes.

Provides endpoints for running what-if policy change simulations.
"""

from typing import Annotated, Any, Dict, List, Optional
from uuid import UUID

from fastapi import APIRouter, Body, Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.core.deps import require_scheme_admin
from app.models.policy_simulation import PolicySimulation
from app.models.user import User
from app.services.policy_simulation_engine import simulate_policy_change

router = APIRouter(prefix="/simulations", tags=["Policy Simulation"])


@router.post("/schemes/{scheme_id}/simulate")
def run_simulation(
    scheme_id: UUID,
    current_user: Annotated[User, Depends(require_scheme_admin)],
    body: Dict[str, Any] = Body(...),
    db: Session = Depends(get_db),
) -> Dict[str, Any]:
    """
    Run a policy simulation against existing application data.

    Body:
      - proposed_config: dict (the new scheme config to test)
      - simulation_name: str (optional)
    """
    proposed_config = body.get("proposed_config")
    if not proposed_config:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="'proposed_config' is required in request body",
        )

    try:
        result = simulate_policy_change(
            db=db,
            scheme_id=scheme_id,
            proposed_config_dict=proposed_config,
            run_by=current_user.id,
            simulation_name=body.get("simulation_name"),
        )
    except ValueError as exc:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=str(exc),
        )

    db.commit()
    return result


@router.get("/schemes/{scheme_id}/history")
def get_simulation_history(
    scheme_id: UUID,
    current_user: Annotated[User, Depends(require_scheme_admin)],
    db: Session = Depends(get_db),
) -> Dict[str, Any]:
    """
    Get simulation run history for a scheme.
    """
    simulations = db.execute(
        select(PolicySimulation)
        .where(PolicySimulation.scheme_id == scheme_id)
        .order_by(PolicySimulation.created_at.desc())
        .limit(20)
    ).scalars().all()

    return {
        "scheme_id": str(scheme_id),
        "simulations": [
            {
                "id": str(s.id),
                "simulation_name": s.simulation_name,
                "base_config_version": s.base_config_version,
                "summary": s.summary,
                "created_at": s.created_at.isoformat(),
                "results": s.results,
            }
            for s in simulations
        ],
    }


@router.get("/{simulation_id}")
def get_simulation_detail(
    simulation_id: UUID,
    current_user: Annotated[User, Depends(require_scheme_admin)],
    db: Session = Depends(get_db),
) -> Dict[str, Any]:
    """
    Get detailed results of a specific simulation run.
    """
    sim = db.execute(
        select(PolicySimulation).where(PolicySimulation.id == simulation_id)
    ).scalar_one_or_none()

    if not sim:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Simulation not found",
        )

    return {
        "id": str(sim.id),
        "scheme_id": str(sim.scheme_id),
        "simulation_name": sim.simulation_name,
        "base_config_version": sim.base_config_version,
        "base_config": sim.base_config,
        "proposed_config": sim.proposed_config,
        "results": sim.results,
        "summary": sim.summary,
        "created_at": sim.created_at.isoformat(),
    }
