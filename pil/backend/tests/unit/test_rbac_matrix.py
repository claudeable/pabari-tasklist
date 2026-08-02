"""Pure unit tests over the hardcoded role->permission matrix (rbac_service module
docstring) — no DB needed, just checking the matrix itself is sound: every role that
should be able to do something can, and nothing grants more than intended."""

from app.services.rbac_service import _ORG_ROLE_PERMISSIONS, _PROJECT_ROLE_PERMISSIONS


def test_org_member_role_has_no_admin_permissions() -> None:
    assert _ORG_ROLE_PERMISSIONS["member"] == set()


def test_org_admin_can_manage_membership_and_projects() -> None:
    admin_perms = _ORG_ROLE_PERMISSIONS["org_admin"]
    assert "org.members.invite" in admin_perms
    assert "org.members.remove" in admin_perms
    assert "org.projects.create" in admin_perms


def test_project_read_only_and_guest_have_no_mutating_permissions() -> None:
    assert _PROJECT_ROLE_PERMISSIONS["read_only"] == set()
    assert _PROJECT_ROLE_PERMISSIONS["guest"] == set()


def test_project_member_has_no_admin_only_permissions() -> None:
    """`member` has legitimately grown day-to-day permissions (send messages, upload
    documents, create tasks) since Phase 2 — the invariant that must hold is that none
    of the project_admin-exclusive management actions leak into it, not that the set
    stays empty."""
    admin_only = {
        "project.update",
        "project.delete",
        "project.members.add",
        "project.members.remove",
        "project.members.role.update",
        "project.partner_orgs.grant",
        "message.delete.any",
        "document.delete",
        "document.approve",
        "document.checkout.override",
        "task.delete",
        "milestone.create",
        "announcement.create",
    }
    assert _PROJECT_ROLE_PERMISSIONS["member"].isdisjoint(admin_only)


def test_project_admin_can_manage_membership_and_delete() -> None:
    admin_perms = _PROJECT_ROLE_PERMISSIONS["project_admin"]
    assert "project.delete" in admin_perms
    assert "project.members.add" in admin_perms
    assert "project.members.remove" in admin_perms
    assert "project.members.role.update" in admin_perms


def test_member_can_create_and_update_tasks_but_not_delete() -> None:
    member_perms = _PROJECT_ROLE_PERMISSIONS["member"]
    assert "task.create" in member_perms
    assert "task.update" in member_perms
    assert "task.comment" in member_perms
    assert "task.delete" not in member_perms


def test_only_project_admin_can_create_milestones_and_announcements() -> None:
    assert "milestone.create" in _PROJECT_ROLE_PERMISSIONS["project_admin"]
    assert "announcement.create" in _PROJECT_ROLE_PERMISSIONS["project_admin"]
    assert "milestone.create" not in _PROJECT_ROLE_PERMISSIONS["member"]
    assert "announcement.create" not in _PROJECT_ROLE_PERMISSIONS["member"]


def test_no_role_is_granted_a_system_admin_permission() -> None:
    from app.services.rbac_service import _SYSTEM_ADMIN_PERMISSIONS

    all_org_perms = set().union(*_ORG_ROLE_PERMISSIONS.values())
    all_project_perms = set().union(*_PROJECT_ROLE_PERMISSIONS.values())
    assert all_org_perms.isdisjoint(_SYSTEM_ADMIN_PERMISSIONS)
    assert all_project_perms.isdisjoint(_SYSTEM_ADMIN_PERMISSIONS)


def test_admin_panel_permissions_are_all_system_admin_scoped() -> None:
    from app.services.rbac_service import _SYSTEM_ADMIN_PERMISSIONS

    expected = {
        "admin.users.create",
        "admin.users.disable",
        "admin.users.reset_password",
        "admin.users.mfa.reset",
        "admin.organizations.create",
        "admin.organizations.suspend",
        "admin.sessions.view",
        "admin.sessions.revoke",
        "admin.devices.revoke",
        "admin.security_events.view",
        "admin.storage.view",
    }
    assert expected <= _SYSTEM_ADMIN_PERMISSIONS
