"""
Committee Integrity & Governance Service for Yojana Setu (SIH26239).

Provides robust multi-member committee governance:
- Quorum requirement verification
- Conflict-of-interest declaration & automatic review blocking
- Member voting, scoring, abstention tracking
- Consolidated consensus and disagreement detection
- Audit logging for governance compliance
"""

from datetime import datetime
import logging
from typing import Any, Dict, List, Optional
import uuid

from sqlalchemy.orm import Session
from sqlalchemy import select

from app.models.application import Application
from app.models.committee_review import CommitteeReview, CommitteeVote
from app.models.conflict import Conflict, ConflictStatus, ConflictType
from app.models.user import User, UserRole
from app.services.audit_service import create_audit_log

logger = logging.getLogger(__name__)

DEFAULT_QUORUM = 3


def record_committee_review(
    db: Session,
    application_id: uuid.UUID,
    committee_member: User,
    vote: str,
    score: Optional[float] = None,
    comments: Optional[str] = None,
    conflict_declared: bool = False,
    conflict_reason: Optional[str] = None,
) -> Dict[str, Any]:
    """
    Record an individual committee member's vote, review score, and conflict declaration.
    Automatically blocks review progression if a conflict of interest is declared.
    """
    application = db.query(Application).filter(Application.id == application_id).first()
    if not application:
        raise ValueError(f"Application {application_id} not found")

    # 1. Check if member already reviewed; update if existing
    review = (
        db.query(CommitteeReview)
        .filter(
            CommitteeReview.application_id == application_id,
            CommitteeReview.committee_member_id == committee_member.id,
        )
        .first()
    )

    if not review:
        review = CommitteeReview(
            application_id=application_id,
            committee_member_id=committee_member.id,
            vote=vote.upper(),
            score=score,
            comments=comments,
            conflict_declared=conflict_declared,
            conflict_reason=conflict_reason,
        )
        db.add(review)
    else:
        review.vote = vote.upper()
        review.score = score
        review.comments = comments
        review.conflict_declared = conflict_declared
        review.conflict_reason = conflict_reason
        review.reviewed_at = datetime.utcnow()

    # 2. If conflict declared, generate Conflict record to block automatic advancement
    if conflict_declared:
        logger.warning(
            "Conflict of interest declared by committee member %s on application %s: %s",
            committee_member.email,
            application_id,
            conflict_reason,
        )
        conflict_record = Conflict(
            application_id=application_id,
            conflict_type=ConflictType.CONCURRENT_SCHOLARSHIP,  # or committee conflict
            status=ConflictStatus.CONFIRMED,
            confidence=1.0,
            matching_signals={
                "declaration_type": "COMMITTEE_MEMBER_CONFLICT",
                "declared_by_email": committee_member.email,
                "declared_by_id": str(committee_member.id),
                "reason": conflict_reason,
            },
            policy_description="Official Selection Committee Conflict of Interest Rule",
            explanation=f"Committee member {committee_member.full_name} declared conflict: {conflict_reason or 'Personal/institutional affiliation'}",
        )
        db.add(conflict_record)

    # 3. Create Audit Log
    create_audit_log(
        db=db,
        application_id=application_id,
        actor_user_id=committee_member.id,
        action="committee_vote_recorded",
        details={
            "member_email": committee_member.email,
            "vote": vote.upper(),
            "score": score,
            "conflict_declared": conflict_declared,
            "conflict_reason": conflict_reason,
        },
    )

    db.commit()
    db.refresh(review)

    return get_committee_summary(db, application_id)


def get_committee_summary(db: Session, application_id: uuid.UUID) -> Dict[str, Any]:
    """
    Get consolidated committee integrity metrics:
    - Quorum count
    - Votes breakdown
    - Unresolved conflicts
    - Governance warnings
    """
    reviews = db.query(CommitteeReview).filter(CommitteeReview.application_id == application_id).all()
    conflicts = db.query(Conflict).filter(Conflict.application_id == application_id).all()

    active_conflicts = [c for c in conflicts if c.status in [ConflictStatus.PENDING_REVIEW, ConflictStatus.CONFIRMED]]
    conflict_detected = len(active_conflicts) > 0 or any(r.conflict_declared for r in reviews)

    approvals = sum(1 for r in reviews if r.vote == "APPROVE")
    rejections = sum(1 for r in reviews if r.vote == "REJECT")
    abstentions = sum(1 for r in reviews if r.vote == "ABSTAIN")
    holds = sum(1 for r in reviews if r.vote == "HOLD")

    total_reviews = len(reviews)
    quorum_met = total_reviews >= DEFAULT_QUORUM

    # Governance Warnings
    warnings = []
    if not quorum_met:
        warnings.append(f"Quorum not met: {total_reviews}/{DEFAULT_QUORUM} members have reviewed.")
    if conflict_detected:
        warnings.append("Review blocked: Unresolved Conflict of Interest declared.")
    if approvals > 0 and rejections > 0:
        warnings.append(f"Split recommendation: {approvals} Approve vs {rejections} Reject. Committee consensus required.")

    # Determine consolidated recommendation
    if conflict_detected:
        recommendation = "BLOCKED_BY_CONFLICT"
    elif not quorum_met:
        recommendation = "PENDING_QUORUM"
    elif approvals >= 2 and rejections == 0:
        recommendation = "CONSENSUS_APPROVED"
    elif rejections > approvals:
        recommendation = "CONSENSUS_REJECTED"
    else:
        recommendation = "DELIBERATION_REQUIRED"

    return {
        "application_id": str(application_id),
        "quorum_required": DEFAULT_QUORUM,
        "quorum_met": quorum_met,
        "total_reviews": total_reviews,
        "vote_counts": {
            "approve": approvals,
            "reject": rejections,
            "abstain": abstentions,
            "hold": holds,
        },
        "conflict_detected": conflict_detected,
        "governance_warnings": warnings,
        "consolidated_recommendation": recommendation,
        "reviews": [
            {
                "member_id": str(r.committee_member_id),
                "member_name": r.member.full_name if r.member else "Committee Member",
                "vote": r.vote,
                "score": r.score,
                "comments": r.comments,
                "conflict_declared": r.conflict_declared,
                "conflict_reason": r.conflict_reason,
                "reviewed_at": r.reviewed_at.isoformat() if r.reviewed_at else None,
            }
            for r in reviews
        ],
    }


def override_committee_conflict(
    db: Session,
    application_id: uuid.UUID,
    override_user: User,
    resolution_remarks: str,
) -> Dict[str, Any]:
    """
    Authorized administrative override for declared conflict of interest.
    Requires SUPER_ADMIN or SCHEME_ADMIN role and leaves immutable audit trail.
    """
    if override_user.role not in [UserRole.SUPER_ADMIN, UserRole.SCHEME_ADMIN]:
        raise PermissionError("Only Super Admin or Scheme Admin can execute governance conflict override.")

    conflicts = db.query(Conflict).filter(Conflict.application_id == application_id).all()
    for c in conflicts:
        c.status = ConflictStatus.CLEARED
        c.resolved_by = override_user.id
        c.resolved_at = datetime.utcnow()
        c.resolution_remarks = resolution_remarks

    create_audit_log(
        db=db,
        application_id=application_id,
        actor_user_id=override_user.id,
        action="committee_conflict_overridden",
        details={
            "override_by_email": override_user.email,
            "remarks": resolution_remarks,
        },
    )

    db.commit()
    return get_committee_summary(db, application_id)
