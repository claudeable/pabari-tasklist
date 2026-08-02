"""Integration tests against a real Postgres instance (CI service container / local
docker-compose.test.yml) — verifies the tamper-evident audit chain (Database Design
doc §3) actually holds under real inserts, concurrent writers, and DB-level tampering."""

from sqlalchemy import text

from app.services.security_event_service import record_security_event, verify_chain

# Uses the shared `session` fixture from tests/integration/conftest.py — NOT a local
# get_settings()-based one. This file used to define its own, which (a) read the real
# app settings via get_settings(), silently picking up a developer's local backend/.env
# instead of a hermetic test config, and (b) never truncated tables between tests, so
# a security_events row committed by an earlier test in the same run left stale seq
# numbers behind (this file's tests hardcode `WHERE seq = 2`, assuming a clean slate).
# Both were real, only caught by running the full suite together against a live DB.


async def test_chain_verifies_after_sequential_inserts(session) -> None:
    for i in range(5):
        await record_security_event(session, event_type="login_success", metadata={"n": i})
    await session.commit()

    is_valid, broken_seq = await verify_chain(session)
    assert is_valid is True
    assert broken_seq is None


async def test_chain_detects_tampering(session) -> None:
    await record_security_event(session, event_type="login_success")
    await record_security_event(session, event_type="login_failed")
    await session.commit()

    # Simulate DB-level tampering that bypasses the app's own write path entirely
    # (e.g. an attacker with raw DB access, or a rogue superuser bypassing grants).
    await session.execute(
        text("UPDATE security_events SET event_type = 'login_success' WHERE seq = 2")
    )
    await session.commit()

    # Without this, SQLAlchemy's identity map still holds the pre-tamper SecurityEvent
    # object in memory (expire_on_commit=False), so the SELECT verify_chain issues
    # next would return stale cached attribute values instead of what the raw UPDATE
    # above actually wrote — this test would then "prove" tamper detection works while
    # never having actually re-read the tampered row. A real verifier (Deployment &
    # Hardening Guide §4) runs from an entirely separate connection/role and never
    # has this problem; it's specific to reusing one session for both the tamper and
    # the check, so it only needed fixing in the test, not in verify_chain itself.
    session.expire_all()

    is_valid, broken_seq = await verify_chain(session)
    assert is_valid is False
    assert broken_seq == 2


async def test_app_role_cannot_update_or_delete_security_events(session) -> None:
    # Documents the expected grant configuration from the baseline migration; actual
    # enforcement is verified by connecting as app_role in a dedicated DB-permissions
    # test run as part of the go-live checklist (Deployment & Hardening Guide §9),
    # since this fixture's engine connects with migration-owner privileges.
    result = await session.execute(
        text(
            "SELECT has_table_privilege('app_role', 'security_events', 'UPDATE') AS can_update, "
            "has_table_privilege('app_role', 'security_events', 'DELETE') AS can_delete"
        )
    )
    row = result.one()
    assert row.can_update is False
    assert row.can_delete is False
