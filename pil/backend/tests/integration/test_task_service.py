"""Security Testing Plan §2 "Business Logic" cases, against a real Postgres instance."""

import asyncio
import uuid

import pytest
from sqlalchemy.ext.asyncio import async_sessionmaker

from app.core.db import create_engine
from app.core.errors import PermissionDeniedError, ResourceNotFoundError
from app.domain.models.organization import Organization
from app.domain.models.project import Project, ProjectMember
from app.services import task_service
from app.services.task_service import TaskValidationError
from tests.integration.conftest import make_user


async def _seed_org_project(session):
    org = Organization(name="Acme", slug=f"acme-{uuid.uuid4().hex[:8]}")
    session.add(org)
    await session.flush()
    creator = await make_user(session)
    project = Project(organization_id=org.id, name="Proj", created_by=creator.id)
    session.add(project)
    await session.commit()
    return org, project


async def test_create_task_rejects_assignee_outside_project(session) -> None:
    org, project = await _seed_org_project(session)
    outsider = await make_user(session)
    creator = await make_user(session)

    with pytest.raises(TaskValidationError):
        await task_service.create_task(
            session, project_id=project.id, organization_id=org.id, title="Do the thing",
            description=None, priority="medium", assignee_id=outsider.id, due_date=None, milestone_id=None,
            created_by=creator.id,
        )


async def test_create_task_accepts_assignee_who_is_a_project_member(session) -> None:
    org, project = await _seed_org_project(session)
    member = await make_user(session)
    creator = await make_user(session)
    session.add(
        ProjectMember(project_id=project.id, organization_id=org.id, user_id=member.id, role="member", added_by=member.id)
    )
    await session.commit()

    task = await task_service.create_task(
        session, project_id=project.id, organization_id=org.id, title="Do the thing",
        description=None, priority="medium", assignee_id=member.id, due_date=None, milestone_id=None,
        created_by=creator.id,
    )
    assert task.assignee_id == member.id


async def test_create_task_rejects_milestone_from_another_project(session) -> None:
    org, project_a = await _seed_org_project(session)
    _org_b, project_b = await _seed_org_project(session)
    creator = await make_user(session)

    from app.repositories import task_repository

    milestone_b = await task_repository.create_milestone(
        session, project_id=project_b.id, organization_id=_org_b.id, name="Launch", due_date=None, created_by=creator.id
    )
    await session.commit()

    with pytest.raises(TaskValidationError):
        await task_service.create_task(
            session, project_id=project_a.id, organization_id=org.id, title="Cross-project task",
            description=None, priority="medium", assignee_id=None, due_date=None, milestone_id=milestone_b.id,
            created_by=creator.id,
        )


async def test_status_transition_skipping_review_is_rejected(session) -> None:
    org, project = await _seed_org_project(session)
    creator = await make_user(session)
    task = await task_service.create_task(
        session, project_id=project.id, organization_id=org.id, title="T",
        description=None, priority="medium", assignee_id=None, due_date=None, milestone_id=None, created_by=creator.id,
    )
    await session.commit()

    with pytest.raises(task_service.TaskValidationError):
        await task_service.update_task(
            session, task_id=task.id, project_id=project.id, title=None, description=None, priority=None,
            new_status="done",  # todo -> done directly, skipping in_progress/review
        )


async def test_valid_status_progression_succeeds(session) -> None:
    org, project = await _seed_org_project(session)
    creator = await make_user(session)
    task = await task_service.create_task(
        session, project_id=project.id, organization_id=org.id, title="T",
        description=None, priority="medium", assignee_id=None, due_date=None, milestone_id=None, created_by=creator.id,
    )
    await session.commit()

    for target in ("in_progress", "review", "done"):
        task = await task_service.update_task(
            session, task_id=task.id, project_id=project.id, title=None, description=None, priority=None, new_status=target
        )
    assert task.status == "done"


async def test_clearing_assignee_is_distinguishable_from_omitting_it(session) -> None:
    org, project = await _seed_org_project(session)
    member = await make_user(session)
    creator = await make_user(session)
    session.add(
        ProjectMember(project_id=project.id, organization_id=org.id, user_id=member.id, role="member", added_by=member.id)
    )
    task = await task_service.create_task(
        session, project_id=project.id, organization_id=org.id, title="T",
        description=None, priority="medium", assignee_id=member.id, due_date=None, milestone_id=None, created_by=creator.id,
    )
    await session.commit()

    # Omitting assignee_id (NOT_PROVIDED, the default) must leave it unchanged.
    unchanged = await task_service.update_task(
        session, task_id=task.id, project_id=project.id, title="renamed", description=None, priority=None, new_status=None
    )
    assert unchanged.assignee_id == member.id

    # Explicitly clearing it (None) must unassign.
    cleared = await task_service.update_task(
        session, task_id=task.id, project_id=project.id, title=None, description=None, priority=None,
        new_status=None, assignee_id=None,
    )
    assert cleared.assignee_id is None


async def test_delete_task_creator_or_admin_only(session) -> None:
    org, project = await _seed_org_project(session)
    creator = await make_user(session)
    other = await make_user(session)
    task = await task_service.create_task(
        session, project_id=project.id, organization_id=org.id, title="T",
        description=None, priority="medium", assignee_id=None, due_date=None, milestone_id=None, created_by=creator.id,
    )
    await session.commit()

    with pytest.raises(PermissionDeniedError):
        await task_service.delete_task(session, task_id=task.id, deleter_id=other.id, can_delete_any=False)

    await task_service.delete_task(session, task_id=task.id, deleter_id=other.id, can_delete_any=True)


async def test_attachment_rejected_for_document_in_different_project(session) -> None:
    org, project_a = await _seed_org_project(session)
    _org_b, project_b = await _seed_org_project(session)
    creator = await make_user(session)

    from app.domain.models.document import Document

    doc_in_b = Document(project_id=project_b.id, organization_id=_org_b.id, name="doc", created_by=creator.id)
    session.add(doc_in_b)
    await session.flush()

    task = await task_service.create_task(
        session, project_id=project_a.id, organization_id=org.id, title="T",
        description=None, priority="medium", assignee_id=None, due_date=None, milestone_id=None, created_by=creator.id,
    )
    await session.commit()

    with pytest.raises(ResourceNotFoundError):
        await task_service.add_attachment(
            session, task_id=task.id, project_id=project_a.id, document_id=doc_in_b.id, added_by=creator.id
        )


async def test_concurrent_status_updates_serialize_without_lost_updates(settings) -> None:
    """Two 'simultaneous' Kanban drag operations on the same task, from two separate
    DB connections — the row lock in get_by_id_for_update must serialize them so the
    task ends in a valid, deterministic state rather than a corrupted/lost update."""
    engine = create_engine(settings)
    from app.domain.models.base import Base

    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)

    factory = async_sessionmaker(engine, expire_on_commit=False)

    async with factory() as setup_session:
        org, project = await _seed_org_project(setup_session)
        creator = await make_user(setup_session)
        task = await task_service.create_task(
            setup_session, project_id=project.id, organization_id=org.id, title="T", description=None,
            priority="medium", assignee_id=None, due_date=None, milestone_id=None, created_by=creator.id,
        )
        await setup_session.commit()
        task_id, project_id = task.id, project.id

    async def _advance(target_status: str) -> bool:
        async with factory() as s:
            try:
                async with s.begin():
                    await task_service.update_task(
                        s, task_id=task_id, project_id=project_id, title=None, description=None, priority=None,
                        new_status=target_status,
                    )
                return True
            except Exception:
                return False

    # Both attempt todo -> in_progress concurrently; both are individually valid
    # transitions, so both may succeed (idempotent-ish), but the row lock must
    # prevent them from interleaving into a torn/inconsistent write.
    results = await asyncio.gather(_advance("in_progress"), _advance("in_progress"))
    assert any(results)

    async with factory() as verify_session:
        from app.repositories import task_repository

        final = await task_repository.get_by_id(verify_session, task_id)
        assert final.status == "in_progress"

    await engine.dispose()
