"""Writes to the tamper-evident security_events audit chain (Database Design doc §3).

This is the ONLY code path permitted to insert security_events rows — do not construct
SecurityEvent rows anywhere else, or the hash chain will fork/break silently.
"""

from __future__ import annotations

import hashlib
import json
import uuid
from datetime import UTC, datetime

from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.domain.models.security_event import GENESIS_HASH, SecurityEvent

# Arbitrary fixed key for a Postgres advisory lock serializing hash-chain writers.
# Advisory locks are session/transaction-scoped and require no table privileges,
# unlike `SELECT ... FOR UPDATE` (which Postgres requires UPDATE privilege for,
# even though it never modifies a row) — app_role has UPDATE/DELETE revoked on
# security_events on purpose (tamper-evidence), so row-locking the table directly
# is not an option here without reopening that privilege.
_CHAIN_LOCK_KEY = 0x5343565F534543  # "SCV_SEC" as a hex literal, just needs to be stable


def _canonical_row_string(
    *,
    seq: int,
    event_type: str,
    user_id: str | None,
    organization_id: str | None,
    ip_address: str | None,
    metadata: dict | None,
    created_at_iso: str,
) -> str:
    # Deterministic, stable field ordering — required for the hash to be reproducible
    # by an independent verifier re-deriving the chain from raw column values.
    payload = {
        "seq": seq,
        "event_type": event_type,
        "user_id": user_id,
        "organization_id": organization_id,
        "ip_address": ip_address,
        "metadata": metadata or {},
        "created_at": created_at_iso,
    }
    return json.dumps(payload, sort_keys=True, separators=(",", ":"))


async def record_security_event(
    session: AsyncSession,
    *,
    event_type: str,
    severity: str = "info",
    user_id: uuid.UUID | None = None,
    organization_id: uuid.UUID | None = None,
    ip_address: str | None = None,
    metadata: dict | None = None,
) -> SecurityEvent:
    # Serialize concurrent writers for the duration of this transaction so they don't
    # fork the chain from the same prev_hash. An advisory lock (not a row lock) since
    # app_role has UPDATE/DELETE revoked on this table by design (see _CHAIN_LOCK_KEY).
    await session.execute(select(func.pg_advisory_xact_lock(_CHAIN_LOCK_KEY)))
    result = await session.execute(select(SecurityEvent).order_by(SecurityEvent.seq.desc()).limit(1))
    last_row = result.scalar_one_or_none()

    next_seq = (last_row.seq + 1) if last_row else 1
    prev_hash = last_row.row_hash if last_row else GENESIS_HASH
    created_at = datetime.now(UTC)

    canonical = _canonical_row_string(
        seq=next_seq,
        event_type=event_type,
        user_id=str(user_id) if user_id else None,
        organization_id=str(organization_id) if organization_id else None,
        ip_address=ip_address,
        metadata=metadata,
        created_at_iso=created_at.isoformat(),
    )
    row_hash = hashlib.sha256((prev_hash + canonical).encode()).hexdigest()

    event = SecurityEvent(
        event_type=event_type,
        severity=severity,
        user_id=user_id,
        organization_id=organization_id,
        ip_address=ip_address,
        metadata_=metadata,
        seq=next_seq,
        prev_hash=prev_hash,
        row_hash=row_hash,
        created_at=created_at,
    )
    session.add(event)
    await session.flush()
    return event


async def verify_chain(session: AsyncSession) -> tuple[bool, int | None]:
    """Recomputes the chain from seq=1. Returns (is_valid, first_broken_seq | None).
    Intended to run under the read-only verification DB role (Deployment & Hardening
    Guide §4), on a schedule and as part of the quarterly DR-drill checklist."""
    result = await session.execute(select(SecurityEvent).order_by(SecurityEvent.seq.asc()))
    rows = result.scalars().all()

    expected_prev = GENESIS_HASH
    for row in rows:
        canonical = _canonical_row_string(
            seq=row.seq,
            event_type=row.event_type,
            user_id=str(row.user_id) if row.user_id else None,
            organization_id=str(row.organization_id) if row.organization_id else None,
            ip_address=row.ip_address,
            metadata=row.metadata_,
            created_at_iso=row.created_at.isoformat(),
        )
        expected_hash = hashlib.sha256((expected_prev + canonical).encode()).hexdigest()
        if row.prev_hash != expected_prev or row.row_hash != expected_hash:
            return False, row.seq
        expected_prev = row.row_hash

    return True, None


async def list_events(
    session: AsyncSession,
    *,
    event_type: str | None = None,
    user_id: uuid.UUID | None = None,
    severity: str | None = None,
    limit: int = 100,
) -> list[SecurityEvent]:
    """Filterable admin audit-log view (Admin Panel doc, API Spec "GET
    /admin/security-events") — callers MUST gate this behind admin.security_events.view.
    security_events carries no RLS policy (it's a global, cross-tenant audit
    surface by design — see Database Design doc §3), so this is reachable regardless
    of any org context; authorization is enforced entirely at the API layer."""
    query = select(SecurityEvent)
    if event_type is not None:
        query = query.where(SecurityEvent.event_type == event_type)
    if user_id is not None:
        query = query.where(SecurityEvent.user_id == user_id)
    if severity is not None:
        query = query.where(SecurityEvent.severity == severity)
    query = query.order_by(SecurityEvent.seq.desc()).limit(min(limit, 500))
    result = await session.execute(query)
    return list(result.scalars().all())
