# Authentication Design

## 1. Identity Model
- Users authenticate with an **alias** (e.g. `Falcon-01`), never a real name or email. Aliases are unique, immutable once assigned, and are the only identity ever shown in UI, logs visible to non-admins, or notifications.
- **No self-registration.** Accounts are created exclusively by a System Administrator (via admin panel) or via `scripts/generate_admin_account.py` for the initial bootstrap admin. The creation flow generates a one-time initial password the admin must relay out-of-band; user is forced to change it on first login.
- **No password recovery by email** (no email exists in the system for auth purposes). Recovery is admin-mediated: admin resets to a new one-time password and forces change at next login, logged as a `security_events` entry.

## 2. Password Policy
- Argon2id hashing, tuned parameters (target ≥250ms hash time on prod hardware): memory ≥19 MiB→ realistically 64–256 MB, iterations ≥3, parallelism ≥1, per `OWASP Password Storage Cheat Sheet`.
- Minimum 14 characters, no arbitrary composition rules (per NIST 800-63B) but checked against a breached-password blocklist (local list, not a third-party API).
- Password history: last 10 hashes retained (`password_history` table); reuse rejected.
- Maximum password age optional/configurable per org policy (NIST discourages forced rotation absent compromise; default: no forced rotation, but immediate forced rotation on any suspected compromise).

## 3. Multi-Factor Authentication (TOTP)
- TOTP (RFC 6238), 30s step, SHA-1/256, 6 digits. Secret generated server-side, shown once via QR (rendered client-side from the secret returned only during enrollment), encrypted at rest (`users.totp_secret_encrypted`).
- **Mandatory** for System Administrator, Organization Administrator, Project Administrator roles. Optional-but-encouraged for Member/Read-Only, enforceable per-org policy.
- Backup/recovery codes: 10 single-use codes generated at enrollment, hashed at rest, admin can revoke and force re-enrollment.
- Replay protection: each TOTP code accepted only once per user (track last-used step in Redis/DB).

**TOTP is phishable** — a user can be tricked into relaying a valid code to an attacker-controlled proxy in real time (adversary-in-the-middle). This is acceptable for the Member/Read-Only/Guest tier but not for roles that can create accounts, change RBAC, or read cross-project audit data.

### 3.1 WebAuthn/FIDO2 for Privileged Roles (phishing-resistant MFA)
- **Required** (not merely available) for System Administrator; **required or org-policy-enforceable** for Organization/Project Administrator. TOTP remains as a fallback enrollment method only for roles below this tier, or as a secondary factor alongside a registered authenticator for privileged roles where a single hardware key would create a lockout risk (register ≥2 authenticators for admins to avoid single-device loss lockout).
- Standard WebAuthn flow: server generates a challenge, browser's platform authenticator (Touch ID/Windows Hello/hardware security key) signs it with a private key that never leaves the device; server verifies the signature against the stored public key + credential ID (`webauthn_credentials` table: `user_id, credential_id, public_key, sign_count, transports, created_at`).
- `sign_count` monotonicity checked on every auth to detect cloned authenticators (a decrease indicates a cloned/replayed credential — reject and alert).
- Origin/RP ID binding is inherent to WebAuthn — this is precisely what makes it phishing-resistant (a spoofed login domain cannot obtain a valid assertion), unlike TOTP where the code itself is portable to any relaying party.
- Enrollment and management follow the same admin-mediated bootstrap model as passwords: an admin cannot enroll a hardware key *for* another user (it must be the user's own physical action), but an admin can revoke a lost/compromised credential and force re-enrollment.

## 4. Device Registration & Trust
- On first login from a new browser/device fingerprint (coarse: UA + a client-generated persisted device id, not invasive fingerprinting), a `devices` row is created as `trusted=false`.
- Admin or the user (via a second-factor step) can mark a device trusted. Untrusted devices may carry tighter session TTLs and trigger a `security_events` notification to the user's other active sessions ("new device login").
- Admin panel: view all devices per user, revoke individually → revocation cascades to kill all sessions tied to that device (join on `sessions.device_id`).

## 5. Tokens & Sessions
- **Access token**: JWT, short-lived (10–15 min), signed with EdDSA (Ed25519) or RS256, held in memory on the client (JS variable), never in localStorage/sessionStorage.
- **Refresh token**: opaque random 256-bit value, stored **hashed** (`sessions.refresh_token_hash`) server-side, delivered to browser only as an httpOnly, Secure, SameSite=Strict cookie scoped to `/api/v1/auth/refresh`.
- **Rotation**: every refresh issues a new refresh token and revokes the old one (`sessions.rotated_from` chain). If a revoked/rotated token is presented again → reuse detected → entire session family revoked, `security_events` critical alert logged, user's active sessions force-logged-out.
- **Session expiry**: access 15 min, refresh 7 days sliding (30 days absolute max), configurable per org security policy. Admin sessions default shorter.
- MFA-verification is a claim in the access token (`mfa: true/false`); routes requiring elevated trust (admin actions, viewing another user's sessions) require `mfa=true` even if the base session is valid — step-up re-auth prompts MFA again if the token lacks it.

## 6. Rate Limiting & Brute-Force Protection
- Redis-backed sliding window: per-IP (e.g. 10 attempts / 5 min) and per-account (e.g. 5 failed attempts → progressive lockout: 1 min, 5 min, 30 min, 24h admin-unlock-only).
- All failures logged to `security_events` (`login_failed`, `mfa_failed`) with IP, UA, timestamp; alerting threshold configurable for SOC/admin review.
- Generic error messages (constant-time comparison, identical response for "no such alias" vs "wrong password" vs "account locked" is intentionally *not* identical for locked accounts — locked state is disclosed only after correct password to avoid a lockout-based enumeration oracle; wrong-alias vs wrong-password stays generic).

## 7. Authorization Enforcement (RBAC)
- Roles: System Administrator, Organization Administrator, Project Administrator, Member, Read Only, Guest — scoped at the appropriate level (`system_role` on `users`, `organization_members.role`, `project_members.role`).
- Every API route declares required permission code(s); a FastAPI dependency (`require_permission("document.approve")`) resolves the caller's effective role for the resource's org/project and checks `role_permissions`.
- Guests: most restrictive — explicit allow-list of routes (e.g., view assigned project only, no export, no invite).
- Least privilege default: newly added members get `read_only` unless explicitly elevated.

## 8. Logout & Revocation
- Logout revokes the current session's refresh token immediately (not just cookie clear).
- "Log out all devices" revokes all sessions for the user; admin equivalent for any user (incident response).
- Password change, MFA reset, or admin-triggered "revoke all sessions" invalidates all outstanding refresh tokens for that user.

## 9. Sequence: Login
```
1. POST /api/v1/auth/login {alias, password}
2. Verify Argon2id hash (constant time regardless of found/not-found via dummy hash)
3. If failed → increment failed_login_count, check lockout thresholds, log security_event, generic error
4. If password OK and mfa_enabled → return mfa_challenge_token (short-lived, single purpose), await TOTP
5. POST /api/v1/auth/mfa/verify {mfa_challenge_token, totp_code}
6. On success: create device (if new)/session rows, issue access token (mfa=true) + refresh cookie
7. Log security_event login_success
```
