# Threat Model (STRIDE)

## 1. Assets
- Message content, document content (confidential corporate data).
- Credentials, TOTP secrets, session/refresh tokens.
- RBAC/permission state (integrity of who-can-see-what).
- Availability of the platform for time-sensitive collaboration.
- Metadata (who talks to whom, when) — sensitive even without content.

## 2. Trust Boundaries
1. Internet ↔ Reverse proxy
2. Reverse proxy ↔ Next.js / FastAPI
3. FastAPI ↔ PostgreSQL / Redis / File store
4. Organization A ↔ Organization B (within a shared project)
5. Authenticated user ↔ Administrator (privilege boundary)
6. Browser ↔ FastAPI (client is fully untrusted)

## 3. STRIDE per Component

### 3.1 Authentication (login, MFA, sessions)
| Threat | Scenario | Mitigation |
|---|---|---|
| Spoofing | Credential stuffing against alias/password | Argon2id, rate limiting (per-IP + per-account), progressive lockout, TOTP MFA mandatory for admins, device registration |
| Spoofing | Stolen refresh token replayed | Refresh token rotation with reuse detection (rotated_from chain) → auto-revoke entire session family on reuse |
| Tampering | JWT claim tampering | Asymmetric signing (RS256/EdDSA), strict `alg` allow-list, signature verified server-side every request |
| Repudiation | User denies performing an admin action | `security_events` immutable audit log, append-only, admin actions logged with actor + target + before/after |
| Information Disclosure | Verbose login error reveals valid aliases | Generic "invalid credentials" for both unknown-alias and wrong-password |
| Denial of Service | Login endpoint flooded | Rate limiting at proxy + app layer, exponential lockout, CAPTCHA-free (no third-party) IP+account throttling via Redis |
| Elevation of Privilege | MFA bypass via race condition or missing enforcement on a route | MFA-verified flag required in token claims for admin-scoped endpoints; server-side re-check, not just login-time |

### 3.2 Authorization / Multi-Tenancy
| Threat | Scenario | Mitigation |
|---|---|---|
| Elevation of Privilege | IDOR: user requests `/documents/{id}` belonging to another org | Repository-layer org filter + PostgreSQL RLS (defense in depth), object ownership re-verified per request, never trust client-supplied org/project id alone |
| Elevation of Privilege | Guest role escalates by editing project_members via a mass-assignment bug | Explicit allow-listed fields in Pydantic schemas (no `**request.dict()` blind updates), RBAC decorator checks specific permission code per route |
| Information Disclosure | Cross-org data leakage via search endpoint | Search queries always scoped by RLS-backed org/project filter, never global full-text without tenant predicate |
| Tampering | Non-admin modifies another user's role client-side | Server re-derives caller's role from DB every request; role changes require `project.member.role.update` permission held by caller |

### 3.3 Messaging / Real-Time
| Threat | Scenario | Mitigation |
|---|---|---|
| Spoofing | WS connection authenticated with stale/guessed token | Short-lived single-use WS ticket issued over authenticated REST, bound to session id, expires in seconds |
| Tampering | Message edited by non-author | Author/permission check server-side before allowing edit/delete; edits produce audit trail (edited_at, prior content retained internally for admin/legal hold, not exposed to other users) |
| Information Disclosure | WS broadcast leaks messages to users not in channel | Server filters subscription topics by verified channel membership at subscribe-time and on every publish |
| Denial of Service | WS connection flood | Per-user/per-IP connection caps, idle timeout, backpressure on Redis pub/sub |

### 3.4 Documents
| Threat | Scenario | Mitigation |
|---|---|---|
| Tampering | Uploaded file is malicious (webshell, macro malware) | MIME/type allow-list, extension/content-type cross-check, virus scan hook (ClamAV) before `scan_status=clean`, files never executed/served from app path |
| Information Disclosure | Predictable storage URLs allow direct object access | Random UUID storage keys, no public bucket/static route, signed short-TTL single-use download tokens only |
| Elevation of Privilege | Path traversal in folder_path or filename | Server-generated storage_key, never derived from user input; folder_path validated against allow-listed characters, never used as filesystem path |
| Repudiation | Document silently altered without version history | Every write creates a new `document_versions` row; `documents.current_version_id` updated only via service layer transaction |
| Denial of Service | Huge file upload exhausts disk | Configurable max upload size enforced at proxy AND app layer, streamed to disk with size cap, per-org storage quota |

### 3.5 API / Injection
| Threat | Scenario | Mitigation |
|---|---|---|
| Tampering | SQL injection | SQLAlchemy 2.0 ORM/Core with bound parameters exclusively; no string-built SQL; CI grep-gate against raw `.execute(f"...")` patterns |
| Tampering | XSS via message content or document name rendered in UI | React auto-escaping by default, CSP with no `unsafe-inline`, output encoding on any HTML rendering path, DOMPurify only if rich text is ever introduced (not in v1) |
| Tampering | CSRF on state-changing requests | SameSite=Strict cookies + double-submit CSRF token required on all mutating requests from browser context |
| Information Disclosure | SSRF via document preview fetching a URL | No server-side fetch of user-supplied URLs; previews generated only from already-uploaded, scanned local files |
| Elevation of Privilege | Mass assignment via flexible JSON body | Strict Pydantic models with `extra="forbid"` |

### 3.6 Infrastructure
| Threat | Scenario | Mitigation |
|---|---|---|
| Information Disclosure | Compromised DB dump exposes plaintext data | Documents/messages encrypted at the application layer before storage (envelope encryption); DB compromise alone insufficient without KMS-held keys |
| Elevation of Privilege | Container escape from a compromised dependency | Non-root containers, read-only root FS, seccomp/AppArmor defaults, minimal base images, no unnecessary capabilities |
| Denial of Service | Resource exhaustion by one tenant | Per-org rate limits and storage quotas, DB connection pool caps, WS connection caps |
| Tampering | Backup exfiltrated and restored elsewhere | Backups encrypted with a key not stored alongside the backup |

## 4. Residual Risk (v1, accepted and documented)
- Chat messages are encrypted at rest and in transit but **not end-to-end** (server holds keys) — required for search, moderation, and admin legal-hold features. Documented as accepted risk; E2EE mode for high-sensitivity channels is a roadmap item (see Roadmap doc), traded off against searchability.
- Single-VPS deployment is a single point of failure for availability unless the operator adds HA (out of v1 scope, covered in DR plan).
