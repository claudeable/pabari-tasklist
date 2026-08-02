# Data Retention & Erasure Policy

Privacy by Design was claimed elsewhere in this doc set without a concrete retention/erasure mechanism to back it up. This document is that mechanism: what is kept, for how long, and how it is actually deleted — from primary storage, backups, and the audit trail.

## 1. Data Classes & Default Retention

| Data | Default Retention | Configurable? | Deletion Mechanism |
|---|---|---|---|
| Messages | Indefinite while project active; purged N days after project deletion (default 90) | Per-org policy | Hard delete row + associated ciphertext; see §3 |
| Documents | Indefinite while project active; purged N days after project/document deletion (default 90) | Per-org policy | Hard delete blob + all versions + wrapped DEKs |
| Tasks/comments/milestones | Same lifecycle as parent project | Per-org policy | Cascade delete with project |
| Sessions/devices | 30 days after `revoked_at`/expiry, then purged | Fixed | Hard delete |
| `security_events` (audit log) | Minimum 1 year, recommended indefinite for a confidentiality-critical platform | Org/compliance-driven, **increase only** — see §4 | Never deleted individually; only bulk-aged per §4 |
| Debug/application logs (non-audit) | 30 days | Fixed | Log rotation, automatic |
| Backups | Per Backup & DR Plan retention (30 days rolling, monthly kept 1 year) | Fixed | Backup expiry/overwrite |

**Default posture**: nothing is deleted silently on a timer except debug logs and expired sessions. Message/document purge windows only start counting after an explicit delete action (user or admin), not from creation — this is a confidential-collaboration platform, not an ephemeral-messaging one; indefinite retention while a project is active is the correct default, not a bug.

## 2. Soft Delete → Hard Delete Lifecycle
- User/admin-initiated delete (message, document, project) sets `deleted_at`, immediately hides the item from all normal queries (repository layer filters `deleted_at IS NULL` universally), but does not destroy ciphertext or keys yet — this is the undo/legal-hold window.
- A scheduled job hard-deletes rows (and, for documents, the underlying encrypted blob + `encrypted_dek`) once `deleted_at` exceeds the configured purge window. Hard delete is irreversible by design: destroying the DEK for a document (not just the ciphertext) means even a backup restore of the ciphertext alone cannot recover it — this is the actual erasure guarantee, not just a DB row removal.
- Org Administrators can place a project/document/user under **legal hold**, which suspends the purge job for that item indefinitely until explicitly lifted — required before any hard-delete job runs, checked as a precondition.

## 3. Cryptographic Erasure
Because every document/message is encrypted with its own DEK (Encryption Design §2), "deletion" for confidentiality purposes can be satisfied by destroying the wrapped DEK alone — the ciphertext becomes permanently unrecoverable garbage even if a copy survives in a backup or an un-scrubbed disk block. The hard-delete job:
1. Deletes the `encrypted_dek` value first (irreversible key destruction), then
2. Deletes the ciphertext blob / row.
This ordering means a crash between steps 1 and 2 still leaves the data cryptographically unrecoverable, which is the property that actually matters.

## 4. Backups & Erasure
- Backups are immutable for their retention window (Backup & DR Plan) — a hard-deleted item may still exist in a backup taken before the delete. This is disclosed, not hidden: the deletion guarantee is "unrecoverable from live systems immediately, unrecoverable from backups once the backup retention window rolls past," not instant everywhere.
- For a confirmed regulatory erasure request needing backup-inclusive erasure sooner than the natural rollover, the affected item's DEK (already destroyed per §3) means restoring that backup does not restore readable data even though the ciphertext bytes are still physically present — cryptographic erasure applies retroactively to backups by construction, without needing to touch backup archives.

## 5. Account/Organization Offboarding
- Disabling a user (`users.status = disabled`) is immediate and revokes all sessions/devices; it does not delete their historical messages (those belong to the conversation/project, not solely to the author — deleting them would corrupt other members' record of the collaboration).
- Full organization offboarding: Org Admin or System Admin can request full erasure of an organization's projects. This runs the same soft-delete → legal-hold-check → hard-delete (crypto-erase) pipeline as §2–3, at organization scope, with a mandatory confirmation step and `security_events` audit entries for the request, approval, and completion.

## 6. security_events Exception
The audit log is intentionally the one data class **not** subject to user- or org-initiated deletion (mutation is already blocked at the DB grant level per Database Design §3's tamper-evident chain). Aging out old audit rows (once retention minimums are satisfied) is a separate, explicitly-authorized bulk operation — append-only chain verified before truncation, and the truncation point itself is logged as a `security_events` entry before it takes effect, so the audit trail records its own aging.

## 7. What This Does Not Cover
- Jurisdiction-specific legal obligations (e.g., GDPR Article 17, sector-specific retention mandates) are the deploying organization's responsibility to configure via the per-org retention settings in §1 — this document defines the *mechanism*, not a specific jurisdiction's compliance posture.
- Data the deploying organization exports out of the platform (e.g., a document downloaded to a member's laptop) is outside SCV's control once it leaves — this policy governs the platform's own copies only.
