# Development Roadmap

## Phase 0 — Foundation (this pass)
- Monorepo scaffold: Next.js frontend, FastAPI backend, PostgreSQL schema for all 13 modules
- Auth (JWT) + RBAC (role/permission tables, `require_permission` dependency)
- Working: Dashboard, Organizations, Projects
- Stubbed but routed/navigable: Communication, Documents, Tasks, Meetings, Engineering, Site Progress, Reports, Knowledge Base, Notifications, Settings
- Docs: architecture, ERD, permission matrix, this roadmap

## Phase 1 — Core collaboration
- **Documents**: folders, drag-and-drop upload to object storage, version control, comments, approvals workflow, PDF/Word/Excel preview, tags, favorites, advanced search
- **Tasks**: full CRUD, Kanban/Table/Calendar/Timeline views, checklists, dependencies, activity log, comments/attachments
- **Notifications**: real in-app notification center wired to the events in Phase 1/2 modules; email delivery via a transactional email provider

## Phase 2 — Real-time & meetings
- **Communication**: WebSocket gateway, channels, DMs, group chats, announcements, @mentions, reactions, threaded replies, pinned messages, read receipts, typing indicators, message search
- **Meetings**: calendar, meeting requests, agenda/minutes, attendance, action items linked to Tasks, recurring meetings, recording links

## Phase 3 — Engineering & site operations
- **Engineering**: technical drawing uploads, revision history, design review workflow, approval workflow, drawing comparison, issue tracking
- **Site Progress**: daily/weekly/monthly reports, photo/video uploads, inspection reports, GPS + weather capture, progress percentage roll-up into Project Health

## Phase 4 — Reporting & knowledge
- **Reports**: cross-module report builder (Progress, Tasks, Meetings, Documents, Engineering, Activity, Risks, Decisions, Site Reports) with PDF/Excel/Word export
- **Knowledge Base**: SOPs, policies, guidelines, templates, lessons learned, manuals, FAQs, categorized + searchable + bookmarkable

## Phase 5 — Settings, security hardening, integrations
- **Settings**: full profile/org settings, roles & permissions editor, notification preferences, audit log viewer, integrations panel, theme/language
- Security hardening: httpOnly/secure auth cookies, refresh tokens, rate limiting, full audit logging on all mutations, encrypted object storage, OWASP ASVS pass
- Background jobs: Celery/RQ + Redis for report generation, notification fan-out, scheduled digests
- Integrations: SharePoint/M365 document sync, Teams bridge, WhatsApp Business API, SMS gateway, Power BI export, GIS mapping, AutoCAD viewer, generic REST connector for partner ERPs

## Phase 6 — Scale & multi-tenancy
- Formalize multi-organization, multi-project support beyond two orgs (already schema-ready — `organization_id`/`project_id` scoping is in place from Phase 0)
- Row-level permission enforcement ("own project only", "assigned projects only") beyond the coarse role checks from Phase 0
- Observability: structured logging, metrics, tracing, backup/restore runbook
- CI/CD: lint + typecheck + test + build gates, containerized deploys, staging environment
