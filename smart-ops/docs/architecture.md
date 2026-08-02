# Architecture — Smart Ops Portal

## 1. Purpose
A secure shared workspace for two (eventually more) organizations collaborating on water infrastructure projects. It is **not** an ERP — each organization keeps its own ERP for finance/procurement/HR. This platform covers cross-organization communication, document sharing, project coordination, decision tracking, task assignment, meetings, engineering collaboration, site progress monitoring, and reporting.

## 2. High-level system diagram

```mermaid
flowchart LR
  subgraph Client
    FE[Next.js App<br/>React + TS + Tailwind + shadcn/ui]
  end

  subgraph API["FastAPI Backend"]
    AUTH[Auth & RBAC]
    REST[REST API /api/v1]
    WS[WebSocket Gateway<br/>(chat, presence, notifications)]
    JOBS[Background Jobs<br/>(reports, notifications, exports)]
  end

  subgraph Data
    PG[(PostgreSQL)]
    OBJ[(Object Storage<br/>documents, drawings, photos)]
  end

  subgraph External["Future Integrations"]
    ERP[Org ERP Systems]
    M365[Microsoft 365 / SharePoint / Teams]
    GWS[Google Workspace]
    CAD[AutoCAD]
    GIS[GIS Mapping]
    BI[Power BI]
    MAIL[Email]
    WA[WhatsApp Business API]
    SMS[SMS Gateway]
  end

  FE -->|HTTPS REST| REST
  FE <-->|WSS| WS
  REST --> PG
  REST --> OBJ
  WS --> PG
  JOBS --> PG
  JOBS --> OBJ
  AUTH --> PG

  REST -.future.-> ERP
  REST -.future.-> M365
  REST -.future.-> GWS
  REST -.future.-> CAD
  REST -.future.-> GIS
  REST -.future.-> BI
  JOBS -.future.-> MAIL
  JOBS -.future.-> WA
  JOBS -.future.-> SMS
```

## 3. Module boundaries

| Module | This pass | Notes |
|---|---|---|
| Dashboard | Working | Aggregation endpoint over other modules |
| Organizations | Working | Company profile, departments, users, roles, contacts |
| Projects | Working | Timeline, milestones, deliverables, budget (display-only), risks, decisions, activity |
| Auth / RBAC | Working | JWT + role/permission tables, `require_permission` dependency |
| Communication | Stub | Data model TBD; will need WebSocket gateway + message store |
| Documents | Stub (model only) | Object storage + version table exist; UI/API deferred |
| Tasks | Stub (model only) | Table exists; Kanban/Table/Calendar/Timeline views deferred |
| Meetings | Stub (model only) | Table exists; calendar integration deferred |
| Engineering | Stub | Drawing versions, design review workflow deferred |
| Site Progress | Stub | Daily/weekly/monthly reports, GPS/weather deferred |
| Reports | Stub | Depends on the modules above having real data first |
| Knowledge Base | Stub | Simple CMS-style content, deferred |
| Notifications | Stub (model only) | In-app table exists; email/SMS fan-out deferred |
| Settings | Stub | Profile/org settings UI shell only |

## 4. Backend architecture (FastAPI)

- **Layering**: `api/v1/endpoints` (HTTP) → `schemas` (Pydantic I/O contracts) → SQLAlchemy `models` (persistence). No service layer yet at this scale; introduce one per-module once business logic grows past simple CRUD (e.g. approval workflows in Documents/Engineering).
- **Auth**: JWT bearer tokens (`app/core/security.py`), password hashing via bcrypt. `get_current_user` dependency resolves the user from the token; `require_permission(code)` enforces RBAC per-endpoint.
- **RBAC model**: `Role` ⟷ `Permission` via `RolePermission`; `User.role_id` is single-role per user for simplicity (a user can be promoted to a different role, not stacked). Multi-role support is a documented future extension if needed.
- **Multi-tenancy**: every domain row that matters is scoped by `organization_id` and/or `project_id` so the schema already supports many organizations and many concurrent projects, even though RBAC checks in this pass are role-based rather than fully row-level.
- **Migrations**: Alembic, one migration per schema change, autogenerate-reviewed.
- **Background jobs**: not implemented yet; the model already anticipates report generation, notification fan-out, and export jobs — introduce Celery/RQ + Redis when Reports/Notifications go live.

## 5. Frontend architecture (Next.js)

- **App Router**, route groups: `app/login`, `app/(app)/*` (authenticated shell).
- **Data fetching**: TanStack React Query hooks per module (`lib/hooks/*`), thin `lib/api-client.ts` wrapper for auth headers and base URL.
- **State**: server state via React Query; minimal client state (theme, sidebar collapse, dashboard widget order) via local component state / localStorage — no global store needed yet.
- **Design system**: shadcn/ui primitives + a small `components/ui-custom/` layer (PageHeader, StatTile, StatusPill, EmptyState, WidgetCard, ModuleStub) so every module — built or stubbed — looks consistent.
- **Auth**: JWT stored client-side in a cookie; `middleware.ts` gates authenticated routes. This is a scaffold-level auth flow — see Security notes below for what production hardening still needs to happen.

## 6. Security notes (scaffold-level vs. production)
Implemented in this pass: JWT auth, bcrypt password hashing, RBAC permission checks on write endpoints, CORS restricted to the frontend origin.

Still required before production: httpOnly+secure cookie (or refresh-token rotation) instead of a client-readable token, rate limiting on `/auth/login`, audit log writes on every mutating action (table exists, not yet wired into every endpoint), encrypted-at-rest object storage, CSRF protection if cookies are used for auth, full OWASP ASVS pass, and a real permission matrix enforced row-by-row (see `permission-matrix.md`) rather than only role-by-endpoint.

## 7. Deployment
`docker-compose.yml` runs Postgres + backend (uvicorn) + frontend (next dev) for local development. Production would split into: Nginx reverse proxy/TLS termination, containerized backend behind a process manager (gunicorn+uvicorn workers), managed Postgres, S3-compatible object storage, and a CI/CD pipeline running lint/typecheck/tests/build before deploy.

## 8. Future integrations
See the "Future Integrations" box in the diagram above. Each is designed to be an outbound adapter behind the REST API (e.g. `integrations/sharepoint.py`, `integrations/power_bi.py`) rather than baked into core modules — Documents would gain a "sync to SharePoint" adapter, Engineering a CAD file adapter, Communication a Teams/WhatsApp bridge, Reports a Power BI export, all without changing core schemas.
