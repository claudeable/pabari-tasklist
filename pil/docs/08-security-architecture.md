# Security Architecture Document

## 1. Guiding Frameworks
OWASP ASVS 4.x Level 2 (target L3 controls where feasible: crypto key management, session binding), OWASP Top 10 (2021), OWASP WSTG for test procedures, NIST SSDF (PW/PS/RV practices), Zero Trust (NIST SP 800-207 principles applied at app scope).

## 2. Defense-in-Depth Layers
1. **Network edge**: firewall (ufw/nftables) — only 443 (and 22 restricted to admin IP allow-list) exposed; all other ports bound to loopback/internal Docker network.
2. **Transport**: TLS 1.3, HSTS, certificate via Let's Encrypt (ACME) or org-provided cert, auto-renewed.
3. **Reverse proxy**: security headers, rate limiting, request size limits, WAF-style basic rule set (block obvious traversal/injection patterns as a coarse first filter — not a substitute for app-layer validation).
4. **Application**: input validation (Pydantic strict schemas), output encoding, CSRF tokens, RBAC on every route, structured error handling with no information leakage.
5. **Data**: parameterized queries only, PostgreSQL RLS, envelope encryption for sensitive columns/files, secrets outside VCS and outside the DB.
6. **Host/Container**: non-root users, read-only root filesystem where possible, dropped Linux capabilities, seccomp default profile, image vulnerability scanning in CI (Trivy or equivalent).
7. **Monitoring/Response**: `security_events` audit trail, log aggregation, alert thresholds, documented Incident Response Plan.

## 3. HTTP Security Headers (baseline, set at proxy + reinforced at app)
```
Strict-Transport-Security: max-age=31536000; includeSubDomains; preload
Content-Security-Policy: default-src 'self'; script-src 'self' 'nonce-<per-request>';
  style-src 'self' 'nonce-<per-request>'; img-src 'self' data:; connect-src 'self' wss://<host>;
  frame-ancestors 'none'; base-uri 'self'; form-action 'self'; object-src 'none'
X-Content-Type-Options: nosniff
X-Frame-Options: DENY
Referrer-Policy: no-referrer
Permissions-Policy: geolocation=(), camera=(), microphone=(), payment=()
Cross-Origin-Opener-Policy: same-origin
Cross-Origin-Resource-Policy: same-site
Cache-Control: no-store  (on all authenticated/API responses)
```

## 4. Cookie Configuration
```
Set-Cookie: scv_refresh=<token>; HttpOnly; Secure; SameSite=Strict; Path=/api/v1/auth/refresh; Max-Age=<ttl>
Set-Cookie: scv_csrf=<token>; Secure; SameSite=Strict; Path=/
```
Access tokens are never placed in a cookie (avoids CSRF-via-cookie for the bearer token entirely); only the refresh token (tightly path-scoped, httpOnly) and a readable CSRF token live in cookies.

## 5. CORS Policy
- No wildcard origins. Explicit allow-list of the deployed frontend origin(s) only, from server config, not user input.
- Credentialed requests (`Access-Control-Allow-Credentials: true`) only for the exact allow-listed origin.

## 6. Input Validation & Output Encoding
- All request bodies validated by Pydantic models with `extra="forbid"`, explicit types/lengths/formats (e.g., alias regex `^[A-Za-z]+-\d{2}$` if using the Falcon-01 convention, or a defined charset otherwise).
- File uploads: extension + MIME allow-list, magic-byte verification (not trusting client-supplied `Content-Type`), size cap, filename sanitized/never used as storage path.
- All user-generated text rendered via React's default escaping; Markdown (if supported for messages) rendered through a strict allow-listed renderer with no raw HTML passthrough.

## 7. Rate Limiting Matrix (defaults, per-org configurable)
| Endpoint class | Limit |
|---|---|
| `/auth/login` | 5/min per IP, 5/15min per account |
| `/auth/mfa/verify` | 5/5min per challenge token |
| `/auth/refresh` | 30/hour per session |
| Document upload | 20/min per user, quota per org |
| General API | 300/min per user (sliding window, Redis) |
| WebSocket connects | 10/min per user |

## 8. Secrets Management
- `.env` files never committed (`.gitignore` enforced, secret-scan pre-commit hook + CI secret scanning e.g. gitleaks).
- Production secrets delivered via Docker secrets or a root-owned, mode-0400 mounted file, referenced by path in config, not by literal env value where the orchestrator supports secret files.
- Rotation procedure documented for: JWT signing key, root encryption secret, DB credentials, TOTP encryption key.

## 9. Logging & Privacy
- Logs use pseudonymous alias + user UUID, never any real-name/PII field (none is collected).
- Message/document *content* is never written to application logs.
- Log retention policy configurable; security_events retained longer than debug logs (audit requirement).
- `security_events` is **tamper-evident**: hash-chained rows, application DB role has no UPDATE/DELETE grant on the table, chain integrity verified on a schedule (see Database Design Document §3 for the chain construction and its limits — it is an integrity control, not a confidentiality one).
- Retention and erasure of all other data classes (messages, documents, sessions) follows the [Data Retention & Erasure Policy](15-data-retention-erasure-policy.md), including cryptographic erasure via DEK destruction — "Privacy by Design" in this doc set is backed by that concrete mechanism, not asserted on its own.

## 10. Dependency & Supply Chain
- Backend: `pip-audit`/`safety` in CI; pinned lockfile (`uv.lock`/`poetry.lock`).
- Frontend: `npm audit`, lockfile committed, Dependabot/renovate for patch updates with CI gate before merge.
- Base Docker images pinned by digest, rebuilt on a schedule to pick up OS security patches.

## 11. ASVS L2+ Control Mapping (representative, not exhaustive)
| ASVS Area | Control | Where implemented |
|---|---|---|
| V2 Authentication | Argon2id, MFA, lockout | `core/security/passwords.py`, `auth_service.py` |
| V3 Session Mgmt | Rotation, short TTL, revocation | `sessions` table, `jwt.py` |
| V4 Access Control | RBAC on every route | `deps.py: require_permission` |
| V5 Validation | Strict Pydantic, allow-lists | `schemas/` |
| V7 Error/Logging | No stack traces to client, structured audit log | `middleware/request_logging.py`, `security_events` |
| V8 Data Protection | Envelope encryption, no plaintext secrets | `core/security/crypto.py` |
| V9 Communications | TLS 1.3, HSTS | proxy config |
| V12 Files | Type/size validation, no execution, signed URLs | `document_service.py` |
| V13 API | Versioned, schema-validated, RESTful status codes | `api/v1/` |
| V14 Config | Hardened headers, no debug in prod, secrets external | `middleware/security_headers.py`, deployment guide |
