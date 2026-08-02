# Software Architecture Document (SAD)
## Secure Collaboration Vault (SCV)

## 1. Purpose & Scope
SCV is a self-hosted, multi-tenant collaboration platform for confidential inter-organization communication (chat, documents, tasks). It replaces email/WhatsApp/Slack for sensitive corporate exchange. No third-party services, no OAuth, no telemetry. Deployed on a single (or small cluster of) Ubuntu LTS VPS under the operator's control.

## 2. Architectural Style
- **Modular monolith** for the backend (FastAPI), not microservices. Rationale: smaller attack surface, simpler trust boundary, easier to audit end-to-end for ASVS L2+, no inter-service auth/network complexity. Internal modules are strictly layered (Repository → Service → API) so it can be split later if scale demands it.
- **Server-rendered trust, client-rendered UX**: Next.js frontend as a strict API client (no direct DB access, no server actions touching secrets). All authorization decisions are enforced server-side (backend), never trusted from client.
- **Zero Trust internal design**: every request — including from the frontend's own BFF layer — is authenticated and authorized; no implicit trust based on network location.

## 3. High-Level Components

```
┌─────────────────────────────────────────────────────────────────┐
│                        Ubuntu LTS VPS                            │
│                                                                   │
│  ┌──────────────┐      ┌───────────────────────────────────┐    │
│  │ Caddy/Nginx  │─TLS1.3│      Next.js (Node runtime)       │    │
│  │ reverse proxy│──────▶│  - SSR shell, no secret handling  │    │
│  │ + security   │      │  - calls backend via internal net  │    │
│  │   headers    │      └───────────────────────────────────┘    │
│  │              │                                                │
│  │              │      ┌───────────────────────────────────┐    │
│  │              │─────▶│         FastAPI (Gunicorn/         │    │
│  │              │      │         Uvicorn workers)            │    │
│  │              │      │  - REST API (versioned /api/v1)     │    │
│  │              │      │  - WebSocket gateway (/ws)           │    │
│  │              │      └───────────────┬───────────────────┘    │
│  └──────────────┘                      │                        │
│                          ┌──────────────┼──────────────┐         │
│                          ▼              ▼              ▼         │
│                    ┌──────────┐  ┌───────────┐  ┌────────────┐  │
│                    │PostgreSQL│  │   Redis    │  │ Encrypted   │  │
│                    │ (primary)│  │(sessions,  │  │ Object/File │  │
│                    │          │  │rate-limit, │  │ Store (disk │  │
│                    │          │  │ pub/sub)   │  │ volume, AES)│  │
│                    └──────────┘  └───────────┘  └────────────┘  │
└─────────────────────────────────────────────────────────────────┘
```

All containers on an internal Docker bridge network (`scv-internal`), not exposed to host except via the reverse proxy. Postgres, Redis, and the file store have **no published ports**.

## 4. Key Components

### 4.1 Reverse Proxy (Caddy preferred, Nginx alternative)
- Terminates TLS 1.3 only, automatic HSTS, OCSP stapling.
- Injects security headers (CSP, X-Frame-Options, X-Content-Type-Options, Referrer-Policy, Permissions-Policy).
- Rate limiting at edge (defense in depth alongside app-layer limits).
- Routes `/api/*` and `/ws` to FastAPI, everything else to Next.js.

### 4.2 Frontend (Next.js/TS/React/Tailwind)
- App Router, strict TypeScript, no `dangerouslySetInnerHTML` without sanitization.
- Acts as a thin client: all business logic and authorization server-side.
- Access tokens held in memory only (not localStorage); refresh via httpOnly, Secure, SameSite=Strict cookie.
- Content Security Policy nonce-based script loading; no inline scripts/eval.

### 4.3 Backend (FastAPI, Python 3.12+)
Layered per module:
```
api/        -> route handlers, request/response Pydantic schemas, input validation
services/   -> business logic, authorization checks, orchestration
repositories/ -> SQLAlchemy 2.0 data access, parameterized queries only
domain/     -> ORM models, enums, value objects
core/       -> config, security (crypto, JWT, Argon2), middleware, logging
```
Dependency Injection via FastAPI `Depends()` for DB sessions, current user, RBAC guards, tenant-scoping.

### 4.4 Database (PostgreSQL)
Single physical cluster; **row-level tenant isolation** via `organization_id` foreign keys enforced in every query at the repository layer, plus PostgreSQL Row-Level Security (RLS) policies as a second, independent enforcement layer (defense in depth — app bug ≠ automatic cross-tenant leak).

### 4.5 Redis
- Session/refresh-token revocation registry (jti blacklist).
- Sliding-window rate limiting counters.
- WebSocket pub/sub fan-out for multi-worker real-time delivery.
- Never stores plaintext secrets or document content — ephemeral, low-sensitivity data only, with `maxmemory-policy noeviction` for correctness of security counters.

### 4.6 Encrypted File Store
- Files stored on an encrypted volume (LUKS at rest) as opaque, randomly-named blobs; application-layer envelope encryption on top (see Encryption Design doc) so even the storage layer alone is not sufficient to read content.
- No public/static URLs. All downloads via short-lived, single-use, HMAC-signed URLs issued by the API and verified server-side.

### 4.7 WebSocket Gateway
- Same FastAPI process (`/ws` endpoint), authenticated via short-lived, single-use WS ticket (never the raw JWT in a query string) issued over the authenticated REST channel.
- Redis pub/sub used to broadcast across multiple Uvicorn workers/replicas.

## 5. Cross-Cutting Concerns
- **Observability**: structured JSON logs (request id, user id (pseudonymous alias), org id, action, result), shipped to local log files with rotation; security-relevant events additionally written to `security_events` table.
- **Config & Secrets**: 12-factor env vars, `.env` never committed, secrets loaded via Docker secrets or a mounted secrets file with restrictive permissions (0400), never baked into images.
- **Migrations**: Alembic, forward-only in production, reviewed migrations required for any schema touching `permissions`, `sessions`, `devices`.
- **Testing**: pytest (unit/integration), Playwright or React Testing Library (frontend), dedicated security test suite (auth bypass, IDOR, injection) run in CI on every PR.

## 6. Deployment Topology
Three Docker Compose profiles: `dev`, `test`, `prod`. Prod profile removes all debug endpoints, disables `/docs` (OpenAPI UI) or protects it behind admin auth, sets `DEBUG=false`, restrictive CORS (no wildcard), and runs all containers as non-root users with read-only root filesystems where feasible.

## 7. Non-Goals (explicitly out of scope v1)
- Native mobile apps.
- Federation between separate SCV instances.
- End-to-end encryption with client-held keys for real-time chat (v1 uses server-side encryption at rest + TLS in transit; see Encryption Design for the E2EE roadmap option for documents).
