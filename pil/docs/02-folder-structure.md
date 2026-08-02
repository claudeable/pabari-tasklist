# Folder Structure

```
scv/
├── docs/                              # Architecture & security docs (this set)
├── docker/
│   ├── docker-compose.dev.yml
│   ├── docker-compose.test.yml
│   ├── docker-compose.prod.yml
│   ├── backend.Dockerfile
│   ├── frontend.Dockerfile
│   └── caddy/
│       └── Caddyfile
├── backend/
│   ├── pyproject.toml
│   ├── alembic.ini
│   ├── alembic/
│   │   └── versions/
│   ├── app/
│   │   ├── main.py                    # FastAPI app factory, middleware wiring
│   │   ├── core/
│   │   │   ├── config.py              # pydantic-settings, env parsing
│   │   │   ├── security/
│   │   │   │   ├── passwords.py       # Argon2 hashing
│   │   │   │   ├── jwt.py             # access/refresh token issuance & verification
│   │   │   │   ├── mfa.py             # TOTP
│   │   │   │   └── crypto.py          # envelope encryption, AEAD helpers
│   │   │   ├── logging.py
│   │   │   ├── rate_limit.py
│   │   │   └── deps.py                # shared FastAPI Depends (current_user, db, rbac)
│   │   ├── domain/
│   │   │   ├── models/                # SQLAlchemy 2.0 ORM models (one file per aggregate)
│   │   │   └── enums.py
│   │   ├── repositories/
│   │   │   ├── base.py
│   │   │   ├── user_repository.py
│   │   │   ├── org_repository.py
│   │   │   ├── project_repository.py
│   │   │   ├── message_repository.py
│   │   │   ├── document_repository.py
│   │   │   └── ...
│   │   ├── services/
│   │   │   ├── auth_service.py
│   │   │   ├── device_service.py
│   │   │   ├── org_service.py
│   │   │   ├── project_service.py
│   │   │   ├── rbac_service.py
│   │   │   ├── chat_service.py
│   │   │   ├── document_service.py
│   │   │   ├── task_service.py
│   │   │   └── notification_service.py
│   │   ├── api/
│   │   │   └── v1/
│   │   │       ├── router.py
│   │   │       ├── auth.py
│   │   │       ├── users.py
│   │   │       ├── organizations.py
│   │   │       ├── projects.py
│   │   │       ├── channels.py
│   │   │       ├── messages.py
│   │   │       ├── documents.py
│   │   │       ├── tasks.py
│   │   │       ├── admin.py
│   │   │       └── ws.py
│   │   ├── schemas/                   # Pydantic request/response DTOs (mirrors api/)
│   │   └── middleware/
│   │       ├── security_headers.py
│   │       ├── csrf.py
│   │       ├── request_logging.py
│   │       └── tenant_isolation.py
│   └── tests/
│       ├── unit/
│       ├── integration/
│       └── security/                  # auth bypass, IDOR, injection test suite
├── frontend/
│   ├── package.json
│   ├── next.config.ts
│   ├── tailwind.config.ts
│   ├── src/
│   │   ├── app/                       # Next.js App Router
│   │   │   ├── (auth)/login/
│   │   │   ├── (dashboard)/orgs/[orgId]/projects/[projectId]/...
│   │   │   └── admin/
│   │   ├── components/
│   │   ├── lib/
│   │   │   ├── api-client.ts          # fetch wrapper, CSRF header, no token in storage
│   │   │   └── ws-client.ts
│   │   ├── hooks/
│   │   └── types/
│   └── tests/
├── .github/
│   └── workflows/
│       ├── ci-backend.yml
│       ├── ci-frontend.yml
│       └── security-scan.yml
└── scripts/
    ├── backup.sh
    ├── restore.sh
    └── generate_admin_account.py       # CLI-only account bootstrap, no self-registration
```

**Rationale for key choices**
- `repositories/` isolates all SQL; `services/` never constructs raw queries, eliminating a whole class of injection risk by construction.
- `middleware/tenant_isolation.py` enforces `organization_id` scoping centrally so no route can accidentally omit it.
- `scripts/generate_admin_account.py` is the only way to create the first System Administrator — no public registration endpoint exists anywhere in `api/`.
