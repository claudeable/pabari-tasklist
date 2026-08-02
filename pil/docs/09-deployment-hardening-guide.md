# Deployment & Hardening Guide

## 1. Host Baseline (Ubuntu LTS)
- Minimal install, unattended-upgrades enabled for security patches.
- `ufw`/`nftables`: default deny inbound; allow 443/tcp, 22/tcp restricted to admin source IP allow-list (or VPN-only SSH).
- SSH: key-only auth, `PasswordAuthentication no`, `PermitRootLogin no`, non-standard port optional, `fail2ban` on SSH.
- Dedicated non-root deploy user; Docker daemon socket not exposed remotely.
- Disk: LUKS full-disk encryption on the volume holding Postgres data and the file store.
- Time sync via `chrony`/`systemd-timesyncd` (accurate timestamps matter for JWT exp/audit correlation).

## 2. Docker/Compose
- Prod compose file: no bind-mounted source code, images built once and tagged, `restart: unless-stopped`.
- Every service: `user: "app:app"` non-root, `read_only: true` root FS with explicit `tmpfs` for writable scratch dirs, `cap_drop: [ALL]` plus only required `cap_add`, `security_opt: [no-new-privileges:true]`.
- Postgres, Redis, file-store volumes: **no `ports:` published** — reachable only via `scv-internal` network from app containers.
- Resource limits (`mem_limit`, `cpus`) set per container to blunt single-tenant resource-exhaustion DoS.

## 3. Reverse Proxy (Caddy example)
```
scv.example.com {
    encode gzip
    header {
        Strict-Transport-Security "max-age=31536000; includeSubDomains; preload"
        X-Content-Type-Options "nosniff"
        X-Frame-Options "DENY"
        Referrer-Policy "no-referrer"
        -Server
    }
    reverse_proxy /api/* backend:8000
    reverse_proxy /ws backend:8000
    reverse_proxy /* frontend:3000
    tls internal_or_acme@example.com
}
```
- TLS min version pinned to 1.3 in proxy config; weak ciphers disabled.
- `/docs` and `/redoc` (OpenAPI UI) either disabled in prod (`FASTAPI_DEBUG=false`, docs_url=None) or proxied only to an admin-auth-gated path.

## 4. Database Hardening
- Postgres `listen_addresses` restricted to the internal network interface only; `pg_hba.conf` requires `scram-sha-256`.
- Application DB role: least privilege — no `SUPERUSER`, no `CREATEDB`, only `SELECT/INSERT/UPDATE/DELETE` on app schema **except** `security_events`, where the app role has `INSERT/SELECT` only (no `UPDATE`/`DELETE`) to preserve the tamper-evident hash chain (Database Design Document §3); migrations run under a separate elevated role used only by CI/deploy, not the runtime app.
- `log_connections`, `log_disconnections`, `log_statement=ddl` enabled for audit.
- RLS enforced (see Database Design doc); app connects with `SET app.current_org_id` per request, never bypasses RLS via superuser.
- A separate read-only DB role (no write grants at all) is provisioned for the scheduled `security_events` chain-verification job, so verification never shares credentials with anything that can write.

## 5. Redis Hardening
- `requirepass` set, bound to internal network only, `protected-mode yes`.
- Dangerous commands renamed/disabled (`FLUSHALL`, `CONFIG`, `KEYS` in prod) via `rename-command`.

## 6. File Storage
- Storage volume mounted with `noexec,nosuid,nodev`.
- Virus scanning: ClamAV daemon container on the internal network; every upload passes through a scan step before `scan_status=clean`; infected files quarantined (not deleted) and flagged to admin.

## 7. CI/CD (GitHub Actions)
- `ci-backend.yml`: ruff/black lint, mypy, pytest (unit+integration+security), pip-audit, Trivy image scan.
- `ci-frontend.yml`: eslint, tsc --noEmit, jest/RTL tests, npm audit.
- `security-scan.yml`: gitleaks secret scan, dependency review, scheduled weekly full scan.
- Branch protection: required checks green + review before merge to `main`; no direct pushes to `main`; deploy only from tagged releases.
- Deploy pipeline never has plaintext prod secrets in repo/workflow YAML — pulled from a secrets manager or injected at deploy time only.

## 7a. Software Bill of Materials & Dependency/License Policy
"Run pip-audit/npm audit" catches known vulnerabilities but not license risk or unreviewed transitive dependency growth — both routinely checked in an ASVS L2+/SSDF review. Concrete requirements:
- **SBOM generation**: every release build produces a CycloneDX SBOM for both backend (`cyclonedx-py` over the resolved `uv.lock`/`poetry.lock`) and frontend (`cyclonedx-npm` over `package-lock.json`), attached as a build artifact and retained alongside that release's image tag — so "what exactly is running in prod v1.4.2" is answerable without re-resolving dependencies later.
- **License allow-list**: CI fails the build if a new dependency introduces a license outside an explicit allow-list (permissive: MIT/BSD/Apache-2.0/ISC by default). Copyleft (GPL/AGPL) dependencies require explicit sign-off recorded in the PR, since AGPL in particular has network-use implications for a hosted platform like this one.
- **Transitive dependency review**: `pip-audit`/`npm audit` block on any Critical/High CVE with no available fix; Medium/Low tracked with a remediation deadline, not silently ignored (mirrors the exit criteria in the Security Testing Plan).
- **Pinning discipline**: lockfiles committed and required to be up to date by CI (fails if `uv.lock`/`package-lock.json` is stale relative to the manifest) — prevents an unpinned transitive dependency from silently changing between builds.
- **Provenance**: base images pinned by digest (already required in §2); this section extends the same "know exactly what you're running" principle to the application dependency graph, not just the OS layer.

## 8. Environment Separation
| Env | Purpose | Data |
|---|---|---|
| dev | local development | synthetic/fake data only |
| test | CI ephemeral | disposable, reset per run |
| prod | live | real data, full hardening, backups active |

Never copy prod data into dev/test. If seed data is needed, generate synthetic fixtures.

## 9. Pre-Go-Live Checklist
- [ ] TLS 1.3 verified (`testssl.sh` or equivalent), HSTS live.
- [ ] All default/example secrets rotated.
- [ ] Debug/docs endpoints disabled.
- [ ] Rate limiting verified under load test.
- [ ] Backups running and a restore drill completed successfully.
- [ ] `security_events` populating and reviewed by an admin.
- [ ] Penetration test checklist executed with all High/Critical resolved.
- [ ] Admin bootstrap account created via script, initial password rotated.
