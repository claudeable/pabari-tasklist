"""Security Testing Plan §2 "Authorization / IDOR" cases, against the real RBAC
resolution service and a real Postgres instance."""

import uuid

from app.domain.enums import SystemRole
from app.domain.models.organization import Organization, OrganizationMember
from app.domain.models.project import Project
from app.domain.models.user import User
from app.services import rbac_service


async def _user(session, alias: str, system_role: str = SystemRole.member.value) -> User:
    from app.core.security.passwords import hash_password

    u = User(alias=alias, password_hash=hash_password("x" * 20), system_role=system_role)
    session.add(u)
    await session.flush()
    return u


async def _org(session, name: str) -> Organization:
    org = Organization(name=name, slug=f"{name.lower()}-{uuid.uuid4().hex[:6]}")
    session.add(org)
    await session.flush()
    return org


async def test_non_member_denied_org_permission(session) -> None:
    org = await _org(session, "Acme")
    user = await _user(session, "Falcon-01")
    await session.commit()

    allowed = await rbac_service.user_has_org_permission(
        session, user_id=user.id, organization_id=org.id, permission_code="org.members.invite"
    )
    assert allowed is False


async def test_org_admin_can_invite_org_member_cannot(session) -> None:
    org = await _org(session, "Acme2")
    admin = await _user(session, "Atlas-04")
    member = await _user(session, "Echo-11")
    session.add_all(
        [
            OrganizationMember(organization_id=org.id, user_id=admin.id, role="org_admin"),
            OrganizationMember(organization_id=org.id, user_id=member.id, role="member"),
        ]
    )
    await session.commit()

    assert (
        await rbac_service.user_has_org_permission(
            session, user_id=admin.id, organization_id=org.id, permission_code="org.members.invite"
        )
        is True
    )
    assert (
        await rbac_service.user_has_org_permission(
            session, user_id=member.id, organization_id=org.id, permission_code="org.members.invite"
        )
        is False
    )


async def test_project_member_from_other_org_cannot_access_project(session) -> None:
    org_a = await _org(session, "OrgA")
    org_b = await _org(session, "OrgB")
    outsider = await _user(session, "Raven-07")
    session.add(OrganizationMember(organization_id=org_b.id, user_id=outsider.id, role="member"))
    project = Project(organization_id=org_a.id, name="Secret Project", created_by=outsider.id)
    session.add(project)
    await session.commit()

    can_access = await rbac_service.user_can_access_project(
        session, user_id=outsider.id, project_id=project.id, organization_id=org_a.id
    )
    assert can_access is False


async def test_org_admin_implicitly_gets_project_admin_rights_within_own_org(session) -> None:
    org = await _org(session, "OrgC")
    org_admin = await _user(session, "Vortex-02")
    session.add(OrganizationMember(organization_id=org.id, user_id=org_admin.id, role="org_admin"))
    project = Project(organization_id=org.id, name="Internal Project", created_by=org_admin.id)
    session.add(project)
    await session.commit()

    # Note: org_admin is NOT an explicit project_member here.
    allowed = await rbac_service.user_has_project_permission(
        session, user_id=org_admin.id, project_id=project.id, organization_id=org.id, permission_code="project.delete"
    )
    assert allowed is True


async def test_org_admin_of_partner_org_does_not_get_project_admin_rights(session) -> None:
    owning_org = await _org(session, "OrgD")
    partner_org = await _org(session, "OrgE")
    partner_admin = await _user(session, "Nomad-08")
    session.add(OrganizationMember(organization_id=partner_org.id, user_id=partner_admin.id, role="org_admin"))
    project = Project(organization_id=owning_org.id, name="Cross-Org Project", created_by=partner_admin.id)
    session.add(project)
    await session.flush()

    from app.domain.models.project import ProjectPartnerOrg

    session.add(ProjectPartnerOrg(project_id=project.id, organization_id=partner_org.id, invited_by=partner_admin.id))
    await session.commit()

    # Partner org's admin can now ACCESS the project (read-level)...
    can_access = await rbac_service.user_can_access_project(
        session, user_id=partner_admin.id, project_id=project.id, organization_id=owning_org.id
    )
    assert can_access is True

    # ...but does NOT get project_admin-equivalent mutating rights just from being an
    # org_admin of the partner org — that would cross the org boundary the docs
    # explicitly forbid (Threat Model §2 trust boundary 4).
    can_delete = await rbac_service.user_has_project_permission(
        session,
        user_id=partner_admin.id,
        project_id=project.id,
        organization_id=owning_org.id,
        permission_code="project.delete",
    )
    assert can_delete is False


async def test_system_admin_bypasses_all_org_and_project_checks(session) -> None:
    org = await _org(session, "OrgF")
    sys_admin = await _user(session, "Sable-03", system_role=SystemRole.system_admin.value)
    project = Project(organization_id=org.id, name="Unrelated Project", created_by=sys_admin.id)
    session.add(project)
    await session.commit()

    assert (
        await rbac_service.user_has_org_permission(
            session, user_id=sys_admin.id, organization_id=org.id, permission_code="org.members.invite"
        )
        is True
    )
    assert (
        await rbac_service.user_has_project_permission(
            session, user_id=sys_admin.id, project_id=project.id, organization_id=org.id, permission_code="project.delete"
        )
        is True
    )


async def test_disabled_system_admin_loses_bypass(session) -> None:
    org = await _org(session, "OrgG")
    sys_admin = await _user(session, "Cipher-06", system_role=SystemRole.system_admin.value)
    sys_admin.status = "disabled"
    await session.commit()

    allowed = await rbac_service.user_has_org_permission(
        session, user_id=sys_admin.id, organization_id=org.id, permission_code="org.members.invite"
    )
    assert allowed is False
