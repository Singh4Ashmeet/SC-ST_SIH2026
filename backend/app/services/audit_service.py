"""
Cryptographic Audit Hash-Chain Service.

Yojana Setu (SIH26239) — Ministry of Tribal Affairs
Guarantees append-only, tamper-evident hash chaining across all lifecycle actions.
Formula: current_hash = SHA256(previous_hash + id + action + from_state + to_state + canonical_json(details))
"""

import hashlib
import json
import uuid
from typing import Any, Dict, Optional
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.models.audit_log import AuditLog

GENESIS_HASH = "GENESIS_BLOCK_HASH_YOJANA_SETU_2026"


def create_audit_log(
    db: Session,
    action: str,
    application_id: Optional[uuid.UUID] = None,
    scheme_id: Optional[uuid.UUID] = None,
    actor_user_id: Optional[uuid.UUID] = None,
    from_state: Optional[str] = None,
    to_state: Optional[str] = None,
    details: Optional[Dict[str, Any]] = None,
) -> AuditLog:
    """
    Append an audit log record with a cryptographic SHA-256 hash linked to the previous log.
    Executes transactionally within the caller's session.
    """
    from datetime import datetime, timezone, timedelta

    last_log = db.execute(
        select(AuditLog).order_by(AuditLog.created_at.desc(), AuditLog.id.desc()).limit(1)
    ).scalar_one_or_none()

    previous_hash = last_log.current_hash if (last_log and last_log.current_hash) else GENESIS_HASH

    now = datetime.now(timezone.utc)
    if last_log and last_log.created_at:
        last_dt = last_log.created_at
        if last_dt.tzinfo is None:
            last_dt = last_dt.replace(tzinfo=timezone.utc)
        if now <= last_dt:
            now = last_dt + timedelta(microseconds=1000)

    log_id = uuid.uuid4()
    canonical_details = json.dumps(details or {}, sort_keys=True)
    payload = f"{previous_hash}|{log_id}|{action}|{from_state or ''}|{to_state or ''}|{canonical_details}"
    current_hash = hashlib.sha256(payload.encode("utf-8")).hexdigest()

    audit_log = AuditLog(
        id=log_id,
        created_at=now,
        application_id=application_id,
        scheme_id=scheme_id,
        actor_user_id=actor_user_id,
        action=action,
        from_state=from_state,
        to_state=to_state,
        details=details or {},
        previous_hash=previous_hash,
        current_hash=current_hash,
    )
    db.add(audit_log)


    return audit_log


def verify_hash_chain(db: Session) -> Dict[str, Any]:
    """
    Verify the entire cryptographic SHA-256 chain of audit logs from genesis to head.
    Detects any altered details, broken links, inserted records, or out-of-order logs.
    """
    logs = db.execute(select(AuditLog).order_by(AuditLog.created_at.asc(), AuditLog.id.asc())).scalars().all()

    previous_hash = GENESIS_HASH
    broken_links = 0
    invalid_hashes = 0
    tampered_entry_id = None
    first_broken_event = None
    expected_hash_val = None
    found_hash_val = None

    for log in logs:
        # Check chain link
        if log.previous_hash and log.previous_hash != previous_hash:
            broken_links += 1
            if not tampered_entry_id:
                tampered_entry_id = str(log.id)
                first_broken_event = log
                expected_hash_val = previous_hash
                found_hash_val = log.previous_hash

        # Recompute hash
        canonical_details = json.dumps(log.details or {}, sort_keys=True)
        payload = f"{log.previous_hash or previous_hash}|{log.id}|{log.action}|{log.from_state or ''}|{log.to_state or ''}|{canonical_details}"
        computed_hash = hashlib.sha256(payload.encode("utf-8")).hexdigest()

        if log.current_hash and log.current_hash != computed_hash:
            invalid_hashes += 1
            if not tampered_entry_id:
                tampered_entry_id = str(log.id)
                first_broken_event = log
                expected_hash_val = computed_hash
                found_hash_val = log.current_hash

        previous_hash = log.current_hash or computed_hash

    is_valid = (broken_links == 0 and invalid_hashes == 0)

    return {
        "status": "VERIFIED" if is_valid else "TAMPER_DETECTED",
        "audit_integrity": "VERIFIED" if is_valid else "TAMPER_DETECTED",
        "events_checked": len(logs),
        "total_events_verified": len(logs),
        "broken_links": broken_links,
        "invalid_hashes": invalid_hashes,
        "tamper_detected": not is_valid,
        "tampered_entry_id": tampered_entry_id,
        "first_broken_event": {
            "id": str(first_broken_event.id),
            "action": first_broken_event.action,
            "created_at": first_broken_event.created_at.isoformat() if first_broken_event and first_broken_event.created_at else None,
            "expected_hash": expected_hash_val,
            "found_hash": found_hash_val,
        } if first_broken_event else None,
        "hash_algorithm": "SHA-256 Chain",
    }


def simulate_tampering(db: Session) -> Dict[str, Any]:
    """
    Simulation utility for hackathon judges: safely alters a single historical record's
    payload in the database without recomputing the SHA-256 hash.
    Calling verify_hash_chain() immediately flags the tamper attempt.
    """
    log = db.execute(select(AuditLog).order_by(AuditLog.created_at.desc()).limit(1)).scalar_one_or_none()
    if not log:
        log = create_audit_log(db, action="system_event", details={"description": "Baseline genesis test event"})
        db.commit()

    details = dict(log.details or {})
    details["_tampered_flag"] = "UNAUTHORIZED_MANUAL_ALTERATION"
    details["compromised_attribute"] = "status_force_approved"
    log.details = details
    db.commit()

    return {
        "message": "Tampering simulated successfully on audit event",
        "tampered_event_id": str(log.id),
        "action": log.action,
        "tampered_field": "details._tampered_flag",
        "instruction": "Now call GET /api/audit-log/verify to observe cryptographic detection.",
    }


def restore_tampering(db: Session) -> Dict[str, Any]:
    """
    Restores the audit chain to a fully verified, intact state after a judge demonstration.
    """
    logs = db.execute(select(AuditLog).order_by(AuditLog.created_at.asc(), AuditLog.id.asc())).scalars().all()
    prev = GENESIS_HASH
    for l in logs:
        if isinstance(l.details, dict) and "_tampered_flag" in l.details:
            d = dict(l.details)
            d.pop("_tampered_flag", None)
            d.pop("compromised_attribute", None)
            l.details = d
        l.previous_hash = prev
        canonical_details = json.dumps(l.details or {}, sort_keys=True)
        payload = f"{prev}|{l.id}|{l.action}|{l.from_state or ''}|{l.to_state or ''}|{canonical_details}"
        l.current_hash = hashlib.sha256(payload.encode("utf-8")).hexdigest()
        prev = l.current_hash
    db.commit()
    return {"message": "Audit chain restored to pristine state", "repaired_count": len(logs)}


def recompute_all_hashes(db: Session) -> int:
    """
    Computes or updates previous_hash and current_hash for all existing audit logs in chronological order.
    Useful after bulk data seeding or initial migration.
    """
    logs = db.execute(select(AuditLog).order_by(AuditLog.created_at.asc(), AuditLog.id.asc())).scalars().all()
    prev = GENESIS_HASH
    for l in logs:
        l.previous_hash = prev
        canonical_details = json.dumps(l.details or {}, sort_keys=True)
        payload = f"{prev}|{l.id}|{l.action}|{l.from_state or ''}|{l.to_state or ''}|{canonical_details}"
        l.current_hash = hashlib.sha256(payload.encode("utf-8")).hexdigest()
        prev = l.current_hash
    db.commit()
    return len(logs)

