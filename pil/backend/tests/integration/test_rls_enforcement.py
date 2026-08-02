"""Verifies PostgreSQL RLS actually enforces tenant isolation independently of
application code (Database Design doc §4, Threat Model §3.2) — connects as `app_role`,
the same least-privileged role the deployed app uses, NOT the test superuser (see
app_role_session fixture docstring for why that distinction matters)."""

import uuid

from sqlalchemy import select, text

from app.domain.models.organization import Organization
from app.domain.models.project import Project
from tests.integration.conftest import make_user


async def _seed_two_orgs_with_projects(session):
    org_a = Organization(name="Org A", slug=f"org-a-{uuid.uuid4().hex[:8]}")
    org_b = Organization(name="Org B", slug=f"org-b-{uuid.uuid4().hex[:8]}")
    session.add_all([org_a, org_b])
    await session.flush()

    creator = await make_user(session)
    project_a = Project(organization_id=org_a.id, name="Alpha", created_by=creator.id)
    project_b = Project(organization_id=org_b.id, name="Beta", created_by=creator.id)
    session.add_all([project_a, project_b])
    await session.commit()
    return org_a, org_b, project_a, project_b


async def test_app_role_without_org_context_sees_nothing(session, app_role_session) -> None:
    await _seed_two_orgs_with_projects(session)

    result = await app_role_session.execute(select(Project))
    # No app.current_org_id set at all -> current_setting(...) is NULL -> every
    # comparison is NULL/false -> fail-closed, not fail-open.
    assert result.scalars().all() == []


async def test_app_role_with_org_a_context_sees_only_org_a_project(session, app_role_session) -> None:
    org_a, org_b, project_a, project_b = await _seed_two_orgs_with_projects(session)

    await app_role_session.execute(
        text("SELECT set_config('app.current_org_id', :org_id, false)").bindparams(org_id=str(org_a.id))
    )
    result = await app_role_session.execute(select(Project))
    visible = result.scalars().all()

    assert [p.id for p in visible] == [project_a.id]


async def test_app_role_cannot_see_org_b_project_by_direct_id_lookup(session, app_role_session) -> None:
    """The critical IDOR-relevant case: even a query that names org B's project id
    explicitly (as an attacker who somehow obtained/guessed the UUID would) returns
    nothing when the session's tenant context is org A."""
    org_a, org_b, project_a, project_b = await _seed_two_orgs_with_projects(session)

    await app_role_session.execute(
        text("SELECT set_config('app.current_org_id', :org_id, false)").bindparams(org_id=str(org_a.id))
    )
    result = await app_role_session.execute(select(Project).where(Project.id == project_b.id))
    assert result.scalar_one_or_none() is None


async def test_partner_org_grant_makes_project_visible_across_orgs(session, app_role_session) -> None:
    org_a, org_b, project_a, project_b = await _seed_two_orgs_with_projects(session)

    from app.domain.models.project import ProjectPartnerOrg

    inviter = await make_user(session)
    session.add(ProjectPartnerOrg(project_id=project_b.id, organization_id=org_a.id, invited_by=inviter.id))
    await session.commit()

    await app_role_session.execute(
        text("SELECT set_config('app.current_org_id', :org_id, false)").bindparams(org_id=str(org_a.id))
    )
    result = await app_role_session.execute(select(Project).where(Project.id == project_b.id))
    # Org A was explicitly granted partner access to org B's project -> now visible.
    assert result.scalar_one_or_none() is not None


async def test_app_role_can_resolve_project_org_id_before_any_context_is_set(session, app_role_session) -> None:
    """Regression test for the FORCE RLS / bootstrap-lookup chicken-and-egg bug caught
    during the Phase 2 pentest pass: without the get_project_organization_id()
    SECURITY DEFINER function (migration 0003), this would return None even though the
    project exists, because app_role has no app.current_org_id set yet at this point
    in a request (that's precisely what this lookup exists to establish)."""
    from app.repositories.project_repository import get_organization_id_for_project

    org_a, org_b, project_a, project_b = await _seed_two_orgs_with_projects(session)

    resolved_org_id = await get_organization_id_for_project(app_role_session, project_a.id)
    assert resolved_org_id == org_a.id


async def test_notifications_rls_isolates_by_recipient_not_org(session, app_role_session) -> None:
    """notifications use a DIFFERENT RLS shape than every other table in this system —
    keyed by app.current_user_id, not app.current_org_id (Phase 6: a user's
    notifications span every org they belong to, so org-scoping doesn't apply)."""
    from app.domain.models.notification import Notification

    user_a = await make_user(session)
    user_b = await make_user(session)
    session.add_all(
        [
            Notification(recipient_id=user_a.id, type="test", payload={}),
            Notification(recipient_id=user_b.id, type="test", payload={}),
        ]
    )
    await session.commit()

    await app_role_session.execute(
        text("SELECT set_config('app.current_user_id', :user_id, false)").bindparams(user_id=str(user_a.id))
    )
    result = await app_role_session.execute(select(Notification))
    visible = result.scalars().all()

    assert len(visible) == 1
    assert visible[0].recipient_id == user_a.id


async def test_notifications_no_user_context_sees_nothing(session, app_role_session) -> None:
    from app.domain.models.notification import Notification

    recipient = await make_user(session)
    session.add(Notification(recipient_id=recipient.id, type="test", payload={}))
    await session.commit()

    result = await app_role_session.execute(select(Notification))
    assert result.scalars().all() == []


async def test_storage_usage_aggregate_function_reachable_by_app_role_without_org_context(
    session, app_role_session
) -> None:
    """Admin storage-usage endpoint has no single org context — verifies the
    SECURITY DEFINER escape hatch (migration 0007) actually works for app_role, the
    same class of bug caught in Phase 2/3 for the bootstrap org-id lookups."""
    result = await app_role_session.execute(text("SELECT get_total_storage_usage_bytes() AS total"))
    row = result.first()
    assert row.total is not None  # reachable at all, regardless of value (0 is fine)


async def test_superuser_connection_bypasses_rls_documenting_why_app_role_matters(session) -> None:
    """Negative control: demonstrates the exact false-confidence trap this test file's
    app_role_session fixture avoids — connecting as the table owner/superuser sees
    everything regardless of org context, which is why RLS must be verified through
    app_role, never through the migration/test-bootstrap connection."""
    org_a, org_b, project_a, project_b = await _seed_two_orgs_with_projects(session)

    await session.execute(
        text("SELECT set_config('app.current_org_id', :org_id, false)").bindparams(org_id=str(org_a.id))
    )
    result = await session.execute(select(Project))
    visible_ids = {p.id for p in result.scalars().all()}
    # If this assertion ever starts failing (i.e. superuser respects RLS), it just
    # means the test DB role configuration changed — not a security regression.
    assert project_b.id in visible_ids
