# Security Testing Plan

## 1. Testing Layers
1. **Static**: linting (ruff/eslint), type checking (mypy/tsc strict), secret scanning (gitleaks), dependency scanning (pip-audit, npm audit), IaC/Dockerfile lint (hadolint).
2. **Unit**: pytest per service/repository; frontend component tests (RTL). Target ≥80% coverage on `services/` and `core/security/`.
3. **Integration**: pytest against a real (containerized) Postgres/Redis — RBAC enforcement, RLS behavior, token rotation/reuse detection.
4. **Security-specific automated suite** (`backend/tests/security/`): run in CI on every PR, block merge on failure.
5. **Manual penetration test**: performed after every module per project convention (see Pentest Checklist doc), and a full-platform pass before go-live and before any major release.
6. **Dynamic scanning**: OWASP ZAP baseline scan against a running test-env instance in CI (nightly, not per-PR, due to runtime).

## 2. Automated Security Test Suite — Required Cases

### Authentication
- [ ] Login rejects wrong password with generic error (no user-enumeration timing/response difference).
- [ ] Account locks after N failed attempts; locked account rejects even correct password.
- [ ] Expired access token rejected on protected route.
- [ ] Refresh token reuse (replay of a rotated/old token) revokes the session family.
- [ ] MFA-required route rejects a token with `mfa=false` even if otherwise valid.
- [ ] Password reuse against `password_history` is rejected.

### Authorization / IDOR
- [ ] User A cannot GET/PATCH/DELETE User B's org's project/document/message by guessing/incrementing IDs.
- [ ] Read-only role receives 403 on every mutating endpoint.
- [ ] Guest role cannot access endpoints outside its explicit allow-list.
- [ ] Removing a user from a project immediately revokes access to that project's resources (no stale-session bypass).
- [ ] Cross-org access only works via an explicit `project_partner_orgs` grant, never implicitly.

### Injection
- [ ] SQLi payloads in every text input field return validation error, not a DB error or altered query behavior.
- [ ] XSS payloads in message body/document name are stored safely and rendered escaped (assert output encoding, not just stored form).
- [ ] Path traversal payloads (`../../etc/passwd`) in filename/folder_path rejected or neutralized.

### File Upload
- [ ] Disallowed MIME/extension rejected.
- [ ] File with mismatched magic bytes vs. claimed content-type rejected.
- [ ] Oversized upload rejected before full read (streaming cap, not post-hoc).
- [ ] Uploaded file is never directly web-accessible by URL guess.

### CSRF / Headers
- [ ] Mutating request without valid CSRF token rejected.
- [ ] Response headers include CSP/HSTS/X-Content-Type-Options/etc. on every response.
- [ ] CORS preflight rejects non-allow-listed origins.

### Rate Limiting
- [ ] Login endpoint enforces per-IP and per-account limits under scripted burst.
- [ ] General API enforces per-user sliding window.

### WebSocket
- [ ] Connection without valid ticket rejected.
- [ ] Ticket reused twice rejected (single-use).
- [ ] User cannot subscribe to a channel they're not a member of.

### Crypto
- [ ] Document ciphertext on disk is not readable without the DEK (spot-check: raw file bytes don't match plaintext, don't trivially decompress).
- [ ] Two encryptions of identical plaintext produce different ciphertext (nonce uniqueness).

## 3. Manual Pentest Cadence
- After each functional module ships (per project working agreement) — see `13-pentest-checklist.md`.
- Full-platform pass pre-go-live.
- Annual (minimum) third-party/independent review recommended once the platform carries real production data.

## 4. Exit Criteria
No merge to `main`, and no production release, while any **Critical** or **High** severity finding remains open. Medium/Low tracked with owner and remediation deadline.
