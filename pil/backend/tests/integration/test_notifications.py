"""Notification triggers, read/unread state, and ownership isolation (Pentest
Checklist §2 IDOR — a notification is a strictly per-user resource)."""

import uuid

from app.domain.models.organization import Organization
from app.domain.models.project import Project, ProjectMember
from app.repositories import notification_repository
from app.services import notification_service, task_service
from tests.integration.conftest import make_user


async def _seed_org_project_with_member(session):
    org = Organization(name="Acme", slug=f"acme-{uuid.uuid4().hex[:8]}")
    session.add(org)
    await session.flush()
    creator = await make_user(session)
    project = Project(organization_id=org.id, name="Proj", created_by=creator.id)
    session.add(project)
    await session.flush()

    assignee = await make_user(session)
    session.add(
        ProjectMember(project_id=project.id, organization_id=org.id, user_id=assignee.id, role="member", added_by=assignee.id)
    )
    await session.commit()
    return org, project, assignee


async def test_task_assignment_creates_notification_for_assignee(session) -> None:
    org, project, assignee = await _seed_org_project_with_member(session)
    creator = await make_user(session)

    await task_service.create_task(
        session, project_id=project.id, organization_id=org.id, title="Do it", description=None,
        priority="medium", assignee_id=assignee.id, due_date=None, milestone_id=None, created_by=creator.id,
    )
    await session.commit()

    notifications = await notification_repository.list_for_user(session, assignee.id)
    assert len(notifications) == 1
    assert notifications[0].type == "task_assigned"


async def test_self_assignment_does_not_notify(session) -> None:
    org, project, assignee = await _seed_org_project_with_member(session)

    await task_service.create_task(
        session, project_id=project.id, organization_id=org.id, title="Do it", description=None,
        priority="medium", assignee_id=assignee.id, due_date=None, milestone_id=None, created_by=assignee.id,
    )
    await session.commit()

    notifications = await notification_repository.list_for_user(session, assignee.id)
    assert notifications == []


async def test_reassignment_notifies_new_assignee(session) -> None:
    org, project, first_assignee = await _seed_org_project_with_member(session)
    second_assignee = await make_user(session)
    session.add(
        ProjectMember(
            project_id=project.id, organization_id=org.id,
            user_id=second_assignee.id, role="member", added_by=first_assignee.id,
        )
    )
    await session.commit()

    creator = await make_user(session)
    task = await task_service.create_task(
        session, project_id=project.id, organization_id=org.id, title="Do it", description=None,
        priority="medium", assignee_id=first_assignee.id, due_date=None, milestone_id=None, created_by=creator.id,
    )
    await session.commit()

    await task_service.update_task(
        session, task_id=task.id, project_id=project.id, title=None, description=None, priority=None,
        new_status=None, assignee_id=second_assignee.id, updated_by=creator.id,
    )
    await session.commit()

    second_notifications = await notification_repository.list_for_user(session, second_assignee.id)
    assert len(second_notifications) == 1


async def test_mark_read_and_unread_filtering(session) -> None:
    recipient = await make_user(session)
    await notification_service.notify(session, recipient_id=recipient.id, type_="test", payload={})
    n2 = await notification_service.notify(session, recipient_id=recipient.id, type_="test", payload={})
    await session.commit()

    unread = await notification_repository.list_for_user(session, recipient.id, unread_only=True)
    assert len(unread) == 2

    updated = await notification_repository.mark_read(session, notification_id=n2.id, user_id=recipient.id)
    assert updated is True

    unread_after = await notification_repository.list_for_user(session, recipient.id, unread_only=True)
    assert len(unread_after) == 1


async def test_cannot_mark_another_users_notification_read(session) -> None:
    """IDOR check: mark_read must be scoped to (notification_id AND recipient_id), not
    notification_id alone."""
    owner = await make_user(session)
    attacker = await make_user(session)
    notification = await notification_service.notify(session, recipient_id=owner.id, type_="test", payload={})
    await session.commit()

    from app.repositories.notification_repository import mark_read as _mark_read

    updated = await _mark_read(session, notification_id=notification.id, user_id=attacker.id)
    assert updated is False

    still_unread = await notification_repository.list_for_user(session, owner.id, unread_only=True)
    assert len(still_unread) == 1


async def test_mark_all_read_only_affects_calling_user(session) -> None:
    user_a = await make_user(session)
    user_b = await make_user(session)
    await notification_service.notify(session, recipient_id=user_a.id, type_="test", payload={})
    await notification_service.notify(session, recipient_id=user_b.id, type_="test", payload={})
    await session.commit()

    await notification_repository.mark_all_read(session, user_id=user_a.id)

    assert await notification_repository.list_for_user(session, user_a.id, unread_only=True) == []
    assert len(await notification_repository.list_for_user(session, user_b.id, unread_only=True)) == 1


async def test_mention_notifies_resolved_user_with_project_access(session) -> None:
    org, project, mentioned = await _seed_org_project_with_member(session)
    mentioned.alias = "Falcon-01"
    await session.commit()

    await notification_service.notify_mentions(
        session, aliases=["Falcon-01", "Nonexistent-99"], message_id=uuid.uuid4(), channel_id=uuid.uuid4(),
        project_id=project.id, organization_id=org.id, author_id=uuid.uuid4(),
    )
    await session.commit()

    notifications = await notification_repository.list_for_user(session, mentioned.id)
    assert len(notifications) == 1
    assert notifications[0].type == "mention"


async def test_mention_of_user_without_project_access_does_not_notify(session) -> None:
    """The fix for the Phase 6 pentest finding: mentioning an alias that resolves to
    a real user with no access to the project must not create a notification —
    otherwise mentioning any guessable alias would leak "activity happened in a
    project you can't see" to an outsider."""
    org, project, _member = await _seed_org_project_with_member(session)
    outsider = await make_user(session, alias="Outsider-09")

    await notification_service.notify_mentions(
        session, aliases=["Outsider-09"], message_id=uuid.uuid4(), channel_id=uuid.uuid4(),
        project_id=project.id, organization_id=org.id, author_id=uuid.uuid4(),
    )
    await session.commit()

    assert await notification_repository.list_for_user(session, outsider.id) == []
