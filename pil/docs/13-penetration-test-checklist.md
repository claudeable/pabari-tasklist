# Penetration Test Checklist

Run this checklist after every completed module, and in full before go-live. For each finding: record Severity (Critical/High/Medium/Low/Info), Risk, Exploitation Steps, Mitigation, and confirm a Code Fix + re-test before closing.

## 1. Authentication & Session
- [ ] Enumerate valid aliases via login/error response differences.
- [ ] Brute-force login bypassing rate limit (distributed IP, header spoofing of X-Forwarded-For).
- [ ] JWT: `alg=none`, algorithm confusion (RS256→HS256 with public key as secret), expired/tampered token acceptance.
- [ ] Session fixation (pre-set session before login).
- [ ] Refresh token replay after rotation.
- [ ] MFA bypass: direct navigation past MFA step, reusing a TOTP code, race condition submitting two codes simultaneously.
- [ ] Concurrent session abuse / missing session binding to device.

## 2. Access Control
- [ ] IDOR across every resource type (message, document, task, project, org) by ID substitution.
- [ ] Horizontal privilege escalation (member A acting on member B's data within same org).
- [ ] Vertical privilege escalation (member forging/requesting admin-only actions).
- [ ] Forced browsing to admin routes without admin token.
- [ ] Parameter pollution / mass assignment on PATCH endpoints (attempt to set `role`, `system_role`, `organization_id` fields not intended to be client-settable).
- [ ] Cross-tenant leakage via search/autocomplete endpoints.

## 3. Injection
- [ ] SQL injection (error-based, boolean-blind, time-blind) on all parameters, headers, and JSON fields.
- [ ] NoSQL/command injection vectors if any shell-outs exist (e.g., virus scan invocation) — verify no user input reaches a shell.
- [ ] XSS: stored (message/comment/document name), reflected (any echoed query param), DOM-based (frontend routing/query handling).
- [ ] XXE: if any XML parsing exists (e.g., document metadata) — verify external entity resolution disabled.
- [ ] SSRF: any endpoint that fetches a URL server-side (should be none in v1 — verify).
- [ ] Template injection in any templated rendering (notification text, etc.).

## 4. File Handling
- [ ] Upload web shell disguised with allowed extension/MIME.
- [ ] Polyglot file (valid image + embedded script) upload and rendering.
- [ ] Path traversal in filename, folder path, or storage key derivation.
- [ ] Zip bomb / decompression bomb if any archive extraction exists.
- [ ] Direct object storage access bypassing signed-URL mechanism.
- [ ] Signed URL reuse after expiry/consumption; URL tampering (bit-flip signature).

## 5. Business Logic
- [ ] Race condition: simultaneous document check-out by two users.
- [ ] Race condition: simultaneous approval/rejection of the same document.
- [ ] Task/document approval workflow bypass (skip states via direct API call).
- [ ] Invite/partner-org flow abused to gain unauthorized project access.
- [ ] Quota bypass (storage limits, rate limits) via parallel requests.

## 6. Transport & Config
- [ ] TLS configuration scan (weak ciphers, TLS <1.3, cert issues).
- [ ] Security headers present and correctly scoped on every response type (including errors, redirects).
- [ ] CORS misconfiguration (reflected origin, wildcard with credentials).
- [ ] Debug endpoints / stack traces reachable in prod-like environment.
- [ ] Verbose error messages leaking internals (SQL errors, file paths, library versions).

## 7. WebSocket
- [ ] Connect without authentication ticket.
- [ ] Subscribe to arbitrary channel IDs outside membership.
- [ ] Message injection/spoofing another user's author identity.
- [ ] Resource exhaustion via connection flooding.

## 8. Cryptography
- [ ] Verify no hardcoded keys/secrets in image layers or repo history.
- [ ] Verify nonce/IV uniqueness under load (no reuse across encryptions).
- [ ] Verify weak/legacy algorithms are unreachable (no fallback path to MD5/SHA1/ECB).
- [ ] Verify key rotation procedure doesn't leave old-key-decryptable data silently unrotated indefinitely.

## 9. Infrastructure
- [ ] Container escape attempt via known CVEs in base image.
- [ ] Privilege check: containers running as non-root, capabilities dropped.
- [ ] Exposed ports scan from outside the host (only 443 and restricted 22 should answer).
- [ ] Backup file/archive accidentally web-accessible.

## 10. Reporting Template (per finding)
```
Title:
Severity: Critical | High | Medium | Low | Info
Component/Module:
Description:
Risk (business impact):
Exploitation Steps (reproducible):
Evidence (request/response, screenshot):
Mitigation Recommendation:
Code Fix Applied (commit/PR ref):
Re-test Result:
Status: Open | Fixed | Accepted Risk
```
