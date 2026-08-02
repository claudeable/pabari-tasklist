# Development Roadmap

Implementation proceeds module by module. **After each module: code review → security review → penetration test (per checklist) → refactor until no Critical/High findings remain**, before starting the next module.

## Phase 0 — Foundations (no user-facing features)
- Repo scaffolding per Folder Structure doc, Docker Compose (dev/test/prod), CI pipelines (lint/type/test/scan gates).
- Core config, logging, security headers middleware, error-handling framework (RFC 7807).
- Database: base schema + Alembic baseline migration, RLS policies scaffold.
- `scripts/generate_admin_account.py` bootstrap.

## Phase 1 — Authentication & Identity
- Argon2id password auth, alias-based login, admin-only account creation.
- JWT access/refresh issuance, rotation, reuse detection.
- TOTP MFA enrollment/verification, backup codes.
- Device registration/trust, session management endpoints.
- Rate limiting + lockout.
- **Gate**: full Authentication section of Pentest Checklist passes.

## Phase 2 — Organizations, Projects, RBAC
- Organizations CRUD (system_admin), org membership.
- Projects CRUD, project membership, roles (project_admin/member/read_only/guest).
- Cross-org partner grants (`project_partner_orgs`).
- RBAC dependency (`require_permission`) wired to every subsequent route as modules land.
- **Gate**: Access Control section of Pentest Checklist passes (IDOR, privilege escalation).

## Phase 3 — Secure Chat
- Channels, messages (create/edit/delete/thread), encryption at rest for message bodies.
- WebSocket gateway with ticket-based auth, Redis pub/sub fan-out.
- Mentions, search (tenant-scoped), read receipts (optional/toggle).
- **Gate**: Injection + WebSocket + Crypto sections pass.

## Phase 4 — Document Management
- Encrypted upload/download pipeline (envelope encryption, signed single-use URLs).
- Versioning, folders, check-in/check-out, approval workflow.
- Virus scan integration (ClamAV hook), metadata, search.
- **Gate**: File Handling section passes.

## Phase 5 — Task Management
- Kanban board, tasks, assignments, priorities, deadlines, comments, attachments (linking to Document module).
- Milestones, announcements.
- **Gate**: Business Logic section passes (race conditions on task/board state).

## Phase 6 — Notifications & Admin Panel
- In-app notification service (no email/SMS), read/unread state.
- Admin panel: org/user/role management, session/device revocation, storage usage, security event viewer.
- **Gate**: full re-run of Access Control + Authentication sections (admin surface is highest privilege).

## Phase 7 — Hardening, DR, Go-Live
- Apply full Deployment & Hardening Guide to a staging environment.
- Backup automation + restore drill (per DR plan).
- Full-platform penetration test pass across every checklist section.
- Load/rate-limit testing under realistic concurrency.
- Go-live checklist sign-off.

## Phase 8 (Post-v1, optional roadmap items)
- High-availability topology (Postgres replication, multi-instance app).
- Optional true end-to-end encryption mode for designated high-sensitivity channels/documents.
- Advanced search (still tenant-isolated), export/legal-hold tooling for admins.
- Fine-grained per-field audit diffing for document/task edits.

## Working Agreement
- No module is considered "done" until its dedicated security review + pentest pass is complete and documented (use the Reporting Template in the Pentest Checklist).
- Architecture documents in `docs/` are living documents — update them when implementation reveals a needed design change, rather than letting code and docs drift.
