"""Standalone DB seed script.

Run with:  python -m app.seed

Wipes existing project/user/content data and reseeds a clean, single-project
demo dataset: baseline roles/permissions, two organizations, departments,
the 8 named team member accounts, and one project ("Smart Ops") with
milestones, deliverables, risks, decisions, tasks, documents, drawings,
site reports, channels/messages and knowledge-base articles.

This is a destructive reset by design — it always produces the same
canonical "Smart Ops only" demo state rather than accumulating data across
runs.
"""

import datetime as dt

from app.core.security import hash_password
from app.db.session import SessionLocal
from app.models.activity_log import ActivityLog
from app.models.channel import Channel, Message
from app.models.decision import Decision, DecisionStatus
from app.models.deliverable import Deliverable
from app.models.department import Department
from app.models.document import Document
from app.models.drawing import Drawing, DrawingComment
from app.models.kb_article import KBArticle
from app.models.meeting import Meeting
from app.models.milestone import Milestone, MilestoneStatus
from app.models.notification import Notification
from app.models.organization import Organization
from app.models.permission import Permission
from app.models.project import Project, ProjectHealth, ProjectStatus
from app.models.project_participant import ProjectParticipant
from app.models.risk import Risk, RiskLikelihood, RiskSeverity, RiskStatus
from app.models.role import Role
from app.models.site_report import SiteReport
from app.models.task import Task
from app.models.user import User

DEFAULT_PASSWORD = "Password123!"

ROLE_NAMES = [
    "System Administrator",
    "Organization Administrator",
    "Project Director",
    "Project Manager",
    "Engineer",
    "Site Engineer",
    "Finance Observer",
    "Procurement Observer",
    "Quality Officer",
    "HSE Officer",
    "Client Representative",
    "Partner Representative",
    "Viewer",
    "Guest",
]

# Roles with full CRUD access to everything.
ADMIN_ROLES = {"System Administrator", "Organization Administrator", "Project Director"}
# Roles with view-only access.
VIEW_ONLY_ROLES = {"Viewer", "Guest", "Finance Observer", "Procurement Observer"}

PERMISSION_DEFS = [
    ("dashboard.view", "View dashboard"),
    ("organizations.view", "View organizations"),
    ("organizations.edit", "Create/edit organizations"),
    ("projects.view", "View projects"),
    ("projects.edit", "Create/edit projects"),
    ("projects.delete", "Delete projects (admin only)"),
    ("documents.view", "View documents"),
    ("documents.edit", "Create/edit documents"),
    ("documents.approve", "Approve documents"),
    ("tasks.view", "View tasks"),
    ("tasks.edit", "Create/edit tasks"),
    ("meetings.view", "View meetings"),
    ("meetings.edit", "Create/edit meetings"),
    ("reports.view", "View reports"),
    ("users.manage", "Manage users and roles"),
    ("communication.view", "View communication channels/messages"),
    ("communication.edit", "Create channels and post messages"),
    ("engineering.view", "View engineering drawings"),
    ("engineering.edit", "Create/edit drawings and comments"),
    ("site_progress.view", "View site progress reports"),
    ("site_progress.edit", "Create site progress reports"),
    ("knowledge_base.view", "View knowledge base articles"),
    ("knowledge_base.edit", "Create/edit knowledge base articles"),
]

VIEW_CODES = {code for code, _ in PERMISSION_DEFS if code.endswith(".view")}

# Functional (non-admin, non-view-only) roles get view-everything plus edit rights
# within their day-to-day domain. organizations.edit/projects.delete are
# included here (not admin-only) per explicit instruction to make add/delete
# on Organizations and Projects available to everyone for now.
FUNCTIONAL_EDIT_DEFAULT = {
    "projects.edit",
    "projects.delete",
    "organizations.edit",
    "tasks.edit",
    "meetings.edit",
    "documents.edit",
    "communication.edit",
    "knowledge_base.edit",
}

# Roles that additionally get edit rights on engineering/site-progress content
# (hands-on technical/field roles per docs/permission-matrix.md).
ENGINEERING_SITE_EDIT_ROLES = {"Engineer", "Site Engineer", "Quality Officer", "HSE Officer"}

# The 8 named team member logins. The login UI shows the name, not the email.
NAMED_USER_DEFS = [
    ("Harshil", "ministry", "hkotecha@kwale-group.com"),
    ("Benson", "ministry", "bnzuka@usm.co.ke"),
    ("Pedro", "ministry", "hpedro@usm.co.ke"),
    ("Suresh", "ministry", "ssuresh@kwale-group.com"),
    ("Liam", "partner", "liam@smart-ops.co.uk"),
    ("Yatin", "partner", "yatin@smart-ops.co.uk"),
    ("Minesh", "partner", "minesh@smart-ops.co.uk"),
    ("Priyesh", "partner", "priyesh@dinsav.com"),
]


def reset_data(db) -> None:
    """Wipe all project/content/user data so the seed always produces a
    clean, single-project ("Smart Ops") demo state. Roles, permissions,
    organizations and departments are left in place (structural, not demo
    content)."""

    for model in [
        Message,
        Channel,
        DrawingComment,
        Drawing,
        SiteReport,
        KBArticle,
        Notification,
        Document,
        Task,
        Meeting,
        ActivityLog,
        Deliverable,
        Milestone,
        Risk,
        Decision,
        ProjectParticipant,
        Project,
        User,
    ]:
        db.query(model).delete(synchronize_session=False)
    db.flush()


def seed_roles_and_permissions(db) -> dict[str, Role]:
    permissions_by_code: dict[str, Permission] = {}
    for code, description in PERMISSION_DEFS:
        perm = db.query(Permission).filter_by(code=code).first()
        if not perm:
            perm = Permission(code=code, description=description)
            db.add(perm)
        permissions_by_code[code] = perm
    db.flush()

    roles_by_name: dict[str, Role] = {}
    for name in ROLE_NAMES:
        role = db.query(Role).filter_by(name=name).first()
        if not role:
            role = Role(name=name, description=f"{name} role")
            db.add(role)
            db.flush()

        if name in ADMIN_ROLES:
            role.permissions = list(permissions_by_code.values())
        elif name in VIEW_ONLY_ROLES:
            role.permissions = [p for code, p in permissions_by_code.items() if code in VIEW_CODES]
        else:
            # Functional roles: view everything + edit within their day-to-day domain.
            grant_codes = set(VIEW_CODES) | FUNCTIONAL_EDIT_DEFAULT
            if name in ENGINEERING_SITE_EDIT_ROLES:
                grant_codes |= {"engineering.edit", "site_progress.edit"}
            role.permissions = [p for code, p in permissions_by_code.items() if code in grant_codes]

        roles_by_name[name] = role

    db.flush()
    return roles_by_name


def seed_organizations(db) -> tuple[Organization, Organization]:
    ministry = db.query(Organization).filter_by(name="Ministry of Water").first()
    if not ministry:
        ministry = Organization(
            name="Ministry of Water",
            industry="Government - Water Resources",
            website="https://water.gov.example",
            address="1 Government Plaza, Capital City",
            primary_contact_name="Amara Osei",
            primary_contact_email="amara.osei@water.gov.example",
            primary_contact_phone="+1-555-0100",
        )
        db.add(ministry)

    partner = db.query(Organization).filter_by(name="Hydrotek Engineering Partners").first()
    if not partner:
        partner = Organization(
            name="Hydrotek Engineering Partners",
            industry="Engineering & Construction",
            website="https://hydrotek.example",
            address="88 Industrial Avenue, Riverside",
            primary_contact_name="Daniel Kim",
            primary_contact_email="daniel.kim@hydrotek.example",
            primary_contact_phone="+1-555-0200",
        )
        db.add(partner)

    db.flush()
    return ministry, partner


def seed_departments(db, ministry: Organization, partner: Organization) -> dict[str, Department]:
    defs = [
        (ministry, "Water Infrastructure"),
        (ministry, "Finance & Procurement"),
        (partner, "Engineering & Design"),
        (partner, "Site Operations"),
    ]
    depts: dict[str, Department] = {}
    for org, name in defs:
        dept = db.query(Department).filter_by(organization_id=org.id, name=name).first()
        if not dept:
            dept = Department(organization_id=org.id, name=name, description=f"{name} department")
            db.add(dept)
        depts[name] = dept
    db.flush()
    return depts


def seed_named_users(
    db, roles_by_name: dict[str, Role], ministry: Organization, partner: Organization, depts: dict
) -> dict[str, User]:
    """The 8 named team member accounts — no role distinction yet (all use
    the Engineer permission set)."""

    hashed = hash_password(DEFAULT_PASSWORD)
    team_role = roles_by_name["Engineer"]

    users: dict[str, User] = {}
    for first_name, org_key, email in NAMED_USER_DEFS:
        org = ministry if org_key == "ministry" else partner
        dept_name = "Water Infrastructure" if org_key == "ministry" else "Engineering & Design"

        user = User(
            organization_id=org.id,
            department_id=depts[dept_name].id,
            full_name=first_name,
            email=email,
            title="Team Member",
            hashed_password=hashed,
            role_id=team_role.id,
            is_active=True,
        )
        db.add(user)
        users[first_name] = user
    db.flush()
    return users


def seed_admin_user(
    db, roles_by_name: dict[str, Role], ministry: Organization, depts: dict
) -> User:
    """Dedicated (non-personal) admin account with full System Administrator
    permissions, including managing users and deleting projects/organizations."""

    hashed = hash_password(DEFAULT_PASSWORD)
    admin = User(
        organization_id=ministry.id,
        department_id=depts["Water Infrastructure"].id,
        full_name="Admin",
        email="admin@usm.co.ke",
        title="System Administrator",
        hashed_password=hashed,
        role_id=roles_by_name["System Administrator"].id,
        is_active=True,
    )
    db.add(admin)
    db.flush()
    return admin


def seed_project(
    db, ministry: Organization, partner: Organization, users: dict[str, User]
) -> Project:
    harshil, benson, pedro, suresh = users["Harshil"], users["Benson"], users["Pedro"], users["Suresh"]
    liam, yatin, minesh, priyesh = users["Liam"], users["Yatin"], users["Minesh"], users["Priyesh"]

    today = dt.date.today()

    project = Project(
        name="Smart Ops",
        code="SMARTOPS-01",
        description="Joint smart-operations initiative for water infrastructure monitoring and coordination.",
        status=ProjectStatus.active,
        health=ProjectHealth.on_track,
        start_date=today - dt.timedelta(days=45),
        end_date=today + dt.timedelta(days=270),
        budget_amount=3_200_000,
        budget_currency="USD",
    )
    db.add(project)
    db.flush()

    db.add(
        ProjectParticipant(
            project_id=project.id,
            organization_id=ministry.id,
            user_id=harshil.id,
            role_on_project="Sponsor",
        )
    )
    db.add(
        ProjectParticipant(
            project_id=project.id,
            organization_id=partner.id,
            user_id=liam.id,
            role_on_project="Lead",
        )
    )
    for u in (benson, pedro, suresh):
        db.add(
            ProjectParticipant(
                project_id=project.id, organization_id=ministry.id, user_id=u.id, role_on_project="Team Member"
            )
        )
    for u in (yatin, minesh, priyesh):
        db.add(
            ProjectParticipant(
                project_id=project.id, organization_id=partner.id, user_id=u.id, role_on_project="Team Member"
            )
        )

    milestone_titles = [
        "Design & Engineering Review",
        "Permitting & Approvals",
        "Procurement of Materials",
        "Construction Phase 1",
    ]
    milestones = []
    for i, title in enumerate(milestone_titles):
        m = Milestone(
            project_id=project.id,
            title=title,
            description=f"{title} for {project.name}",
            due_date=today + dt.timedelta(days=30 * (i + 1)),
            status=MilestoneStatus.in_progress if i == 0 else MilestoneStatus.pending,
        )
        db.add(m)
        milestones.append(m)
    db.flush()

    for i in range(3):
        db.add(
            Deliverable(
                project_id=project.id,
                milestone_id=milestones[i % len(milestones)].id,
                title=f"{project.name} - Deliverable {i + 1}",
                description="Auto-seeded deliverable",
                status="in_progress" if i == 0 else "pending",
                due_date=today + dt.timedelta(days=20 * (i + 1)),
                owner_user_id=minesh.id,
            )
        )

    db.add(
        Risk(
            project_id=project.id,
            title="Supply chain delays for specialized equipment",
            description="Long lead times on imported sensors/controllers may delay rollout.",
            severity=RiskSeverity.high,
            likelihood=RiskLikelihood.medium,
            status=RiskStatus.open,
            owner_user_id=liam.id,
        )
    )
    db.add(
        Risk(
            project_id=project.id,
            title="Field connectivity gaps for remote monitoring sites",
            description="Some sites may lack reliable connectivity for real-time telemetry.",
            severity=RiskSeverity.medium,
            likelihood=RiskLikelihood.medium,
            status=RiskStatus.open,
            owner_user_id=harshil.id,
        )
    )

    db.add(
        Decision(
            project_id=project.id,
            title="Approve monitoring platform architecture",
            description="Sign-off required on the proposed sensor/telemetry architecture.",
            decided_by_user_id=None,
            decision_date=today + dt.timedelta(days=10),
            status=DecisionStatus.proposed,
        )
    )
    db.add(
        Decision(
            project_id=project.id,
            title="Select primary sensor hardware vendor",
            description="Chose between shortlisted vendors for field sensor hardware.",
            decided_by_user_id=harshil.id,
            decision_date=today - dt.timedelta(days=5),
            status=DecisionStatus.approved,
        )
    )

    for i in range(4):
        db.add(
            ActivityLog(
                project_id=project.id,
                organization_id=partner.id if i % 2 == 0 else ministry.id,
                user_id=(liam if i % 2 == 0 else harshil).id,
                action="update",
                entity_type="project",
                entity_id=str(project.id),
                description=f"Progress update #{i + 1} logged for {project.name}",
            )
        )

    # A couple of sample tasks with named owners and an update thread.
    task1 = Task(
        project_id=project.id,
        title="Calibrate flow sensors at Site A",
        description="Verify calibration against reference meter and log readings.",
        priority="high",
        status="in_progress",
        owner_user_id=minesh.id,
        due_date=today + dt.timedelta(days=7),
        progress_percent=40,
    )
    task2 = Task(
        project_id=project.id,
        title="Draft weekly ops report template",
        description="Standard template covering uptime, alerts and field visits.",
        priority="medium",
        status="open",
        owner_user_id=suresh.id,
        due_date=today + dt.timedelta(days=14),
        progress_percent=0,
    )
    db.add(task1)
    db.add(task2)
    db.flush()

    db.add(
        ActivityLog(
            project_id=project.id,
            user_id=minesh.id,
            action="comment",
            entity_type="task",
            entity_id=str(task1.id),
            description="Started calibration on sensors 1-4, within tolerance so far.",
        )
    )

    db.flush()
    return project


def seed_module_demo_data(db, project: Project, users: dict[str, User]) -> None:
    """A small amount of demo data for Communication, Engineering, Site
    Progress and Knowledge Base, scoped to the single Smart Ops project."""

    harshil, liam, minesh, yatin, priyesh = (
        users["Harshil"],
        users["Liam"],
        users["Minesh"],
        users["Yatin"],
        users["Priyesh"],
    )
    today = dt.date.today()

    # --- channels + messages -------------------------------------------
    general = Channel(project_id=project.id, name="General")
    updates = Channel(project_id=project.id, name="Field Updates")
    db.add(general)
    db.add(updates)
    db.flush()

    db.add(Message(channel_id=general.id, user_id=harshil.id, body=f"Welcome to the {project.name} channel."))
    db.add(Message(channel_id=general.id, user_id=liam.id, body="Kickoff notes are in Documents."))
    db.add(Message(channel_id=updates.id, user_id=yatin.id, body="Field mobilization on schedule this week."))

    # --- drawings + comments --------------------------------------------
    drawing1 = Drawing(
        project_id=project.id,
        title=f"{project.code} - Sensor Network Layout",
        discipline="Instrumentation",
        version=1,
        file_url="https://files.example.com/drawings/sensor-network-layout.pdf",
        status="in_review",
        uploaded_by_user_id=minesh.id,
    )
    drawing2 = Drawing(
        project_id=project.id,
        title=f"{project.code} - Control Room Schematic",
        discipline="Electrical",
        version=1,
        file_url="https://files.example.com/drawings/control-room-schematic.pdf",
        status="approved",
        uploaded_by_user_id=minesh.id,
    )
    db.add(drawing1)
    db.add(drawing2)
    db.flush()

    db.add(DrawingComment(drawing_id=drawing1.id, user_id=priyesh.id, body="Confirm sensor spacing against site survey."))
    db.add(DrawingComment(drawing_id=drawing2.id, user_id=yatin.id, body="Approved for installation."))

    # --- site reports -----------------------------------------------------
    for i in range(3):
        db.add(
            SiteReport(
                project_id=project.id,
                report_date=today - dt.timedelta(days=7 * i),
                description=f"Weekly field progress update #{3 - i} for {project.name}.",
                progress_percent=min(15 * (i + 1), 100),
                weather="Clear" if i % 2 == 0 else "Light rain",
                gps_location="0.0000,0.0000",
                submitted_by_user_id=yatin.id,
            )
        )

    # --- knowledge base articles -------------------------------------------
    kb_defs = [
        (
            "Standards",
            "Sensor Calibration Guidelines",
            "Reference procedure for calibrating flow and pressure sensors against a certified meter.",
            ["engineering", "sensors"],
        ),
        (
            "Process",
            "Field Report Submission Checklist",
            "What to capture in a weekly site report: progress %, weather, GPS location and photos.",
            ["field", "process"],
        ),
        (
            "Safety",
            "Site Access & PPE Requirements",
            "Mandatory PPE and access procedures for field visits to monitoring sites.",
            ["hse", "safety"],
        ),
    ]
    for category, title, content, tags in kb_defs:
        db.add(
            KBArticle(
                category=category,
                title=title,
                content=content,
                tags=tags,
                author_user_id=priyesh.id,
            )
        )

    db.flush()


def main() -> None:
    db = SessionLocal()
    try:
        reset_data(db)

        roles_by_name = seed_roles_and_permissions(db)
        ministry, partner = seed_organizations(db)
        depts = seed_departments(db, ministry, partner)
        users = seed_named_users(db, roles_by_name, ministry, partner, depts)
        admin = seed_admin_user(db, roles_by_name, ministry, depts)
        project = seed_project(db, ministry, partner, users)
        seed_module_demo_data(db, project, users)

        db.commit()

        print("\nSeed complete. Project: Smart Ops\n")
        print(f"{'Name':<12} Email")
        print("-" * 60)
        print(f"{'Admin':<12} {admin.email}")
        for name, u in users.items():
            print(f"{name:<12} {u.email}")
        print(f"\nAll seeded users share the password: {DEFAULT_PASSWORD}\n")
    except Exception:
        db.rollback()
        raise
    finally:
        db.close()


if __name__ == "__main__":
    main()
