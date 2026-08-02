# Secure Collaboration Vault (SCV)

Confidential collaboration platform for inter-organization communication — chat,
documents, tasks. Architecture and security documentation lives in [`docs/`](docs/);
implementation follows the phased order in
[`docs/14-development-roadmap.md`](docs/14-development-roadmap.md).

**Status: Phase 0 (Foundations) scaffolded.** Authentication endpoints, the RBAC engine
beyond system_admin, chat, documents, and tasks are not yet implemented — see the
roadmap for build order. Each phase is gated on a security review + penetration test
pass (checklist in [`docs/13-penetration-test-checklist.md`](docs/13-penetration-test-checklist.md))
before the next phase starts.

## Local development

```bash
# 1. Generate dev-only secrets (gitignored, never for production use)
bash scripts/generate_dev_secrets.sh

# 2. Bring up the stack
docker compose -f docker/docker-compose.dev.yml up --build

# 3. Backend: http://localhost:8000/api/v1/healthz
#    Frontend: http://localhost:3000
```

Backend tests (requires local Postgres/Redis, or run via docker-compose.test.yml):

```bash
cd backend
pip install -e ".[dev]"
alembic upgrade head
pytest tests/unit tests/integration tests/security -v
```

## Creating the first account

There is no self-registration. Bootstrap the first System Administrator:

```bash
python scripts/generate_admin_account.py --alias Falcon-01
```

The one-time password is printed once — relay it to the operator out-of-band. It must
be changed, and MFA (WebAuthn, required for System Administrator) enrolled, on first
login.

## Documentation index

See [`docs/`](docs/) for the Software Architecture Document, Threat Model (STRIDE),
Database Design, Authentication & Encryption Design, API Specification, Security
Architecture, Deployment & Hardening Guide, Incident Response Plan, Backup & DR Plan,
Security Testing Plan, Penetration Test Checklist, Data Retention & Erasure Policy, and
Development Roadmap.
