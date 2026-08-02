# Database Design Document

## 1. Conventions
- All PKs: `UUID` (v4), generated app-side or `gen_random_uuid()` — never sequential integers (prevents enumeration/IDOR-by-guessing).
- All tables: `created_at`, `updated_at` (UTC timestamptz); mutable business tables also get `deleted_at` (soft delete) where audit retention matters (messages, documents).
- All foreign keys `ON DELETE RESTRICT` by default; explicit `CASCADE` only where domain-correct (e.g., `document_versions` → `documents`).
- Every tenant-scoped table carries `organization_id` directly (denormalized, not just via join) so RLS policies and repository guards can filter in one hop.

## 2. Entity Relationship Diagram (textual)

```
organizations ──< organization_members >── users
     │                                        │
     │                                       (alias-only identity)
     ▼
  projects ──< project_members >── users
     │
     ├──< channels ──< messages ──< message_attachments
     │                    │
     │                    └──< message_reads (read receipts, optional)
     │
     ├──< documents ──< document_versions
     │        │
     │        └──< document_permissions
     │
     ├──< tasks (kanban) ──< task_comments
     │        └──< task_attachments
     │
     ├──< milestones
     └──< announcements

users ──< devices ──< sessions
users ──< security_events
users ──< password_history
roles ──< permissions (role_permissions join)
users ──< user_roles >── (scoped to organization_id / project_id)
notifications >── users (recipient)
```

## 3. Core Tables (representative DDL sketch)

```sql
CREATE TABLE organizations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(120) NOT NULL,
    slug VARCHAR(60) UNIQUE NOT NULL,
    status VARCHAR(20) NOT NULL DEFAULT 'active', -- active|suspended
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE users (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    alias VARCHAR(32) UNIQUE NOT NULL,          -- e.g. Falcon-01; never a real name
    password_hash TEXT NOT NULL,                -- Argon2id
    totp_secret_encrypted TEXT,                 -- envelope-encrypted at rest
    mfa_enabled BOOLEAN NOT NULL DEFAULT false,
    status VARCHAR(20) NOT NULL DEFAULT 'active',-- active|locked|disabled
    failed_login_count INT NOT NULL DEFAULT 0,
    locked_until TIMESTAMPTZ,
    system_role VARCHAR(30) NOT NULL DEFAULT 'member', -- system_admin|member (fine-grained roles below)
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE password_history (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    password_hash TEXT NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE organization_members (
    organization_id UUID NOT NULL REFERENCES organizations(id),
    user_id UUID NOT NULL REFERENCES users(id),
    role VARCHAR(30) NOT NULL, -- org_admin|member
    invited_by UUID REFERENCES users(id),
    joined_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    PRIMARY KEY (organization_id, user_id)
);

CREATE TABLE projects (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id UUID NOT NULL REFERENCES organizations(id),
    name VARCHAR(150) NOT NULL,
    description TEXT,
    created_by UUID NOT NULL REFERENCES users(id),
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
-- Cross-org collaboration: a project can grant access to a partner org explicitly
CREATE TABLE project_partner_orgs (
    project_id UUID NOT NULL REFERENCES projects(id),
    organization_id UUID NOT NULL REFERENCES organizations(id),
    invited_by UUID NOT NULL REFERENCES users(id),
    invited_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    PRIMARY KEY (project_id, organization_id)
);

CREATE TABLE project_members (
    project_id UUID NOT NULL REFERENCES projects(id),
    user_id UUID NOT NULL REFERENCES users(id),
    organization_id UUID NOT NULL REFERENCES organizations(id), -- denormalized for RLS
    role VARCHAR(30) NOT NULL, -- project_admin|member|read_only|guest
    added_by UUID NOT NULL REFERENCES users(id),
    added_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    PRIMARY KEY (project_id, user_id)
);

CREATE TABLE channels (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    project_id UUID NOT NULL REFERENCES projects(id),
    organization_id UUID NOT NULL, -- owning org context for RLS (project owner org)
    name VARCHAR(100) NOT NULL,
    is_private BOOLEAN NOT NULL DEFAULT false,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE messages (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    channel_id UUID NOT NULL REFERENCES channels(id),
    author_id UUID NOT NULL REFERENCES users(id),
    parent_message_id UUID REFERENCES messages(id), -- threaded replies
    ciphertext BYTEA NOT NULL,          -- AEAD-encrypted body
    nonce BYTEA NOT NULL,
    edited_at TIMESTAMPTZ,
    deleted_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE message_attachments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    message_id UUID NOT NULL REFERENCES messages(id),
    document_id UUID NOT NULL REFERENCES documents(id)
);

CREATE TABLE documents (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    project_id UUID NOT NULL REFERENCES projects(id),
    organization_id UUID NOT NULL,
    folder_path VARCHAR(500) NOT NULL DEFAULT '/',
    name VARCHAR(255) NOT NULL,
    current_version_id UUID, -- FK added after document_versions exists
    status VARCHAR(20) NOT NULL DEFAULT 'draft', -- draft|pending_approval|approved|rejected
    checked_out_by UUID REFERENCES users(id),
    checked_out_at TIMESTAMPTZ,
    created_by UUID NOT NULL REFERENCES users(id),
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    deleted_at TIMESTAMPTZ
);

CREATE TABLE document_versions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    document_id UUID NOT NULL REFERENCES documents(id),
    version_number INT NOT NULL,
    storage_key VARCHAR(255) NOT NULL,   -- opaque blob name on disk, not derived from filename
    encrypted_dek BYTEA NOT NULL,        -- per-file data key wrapped by org KEK
    file_hash_sha256 CHAR(64) NOT NULL,
    size_bytes BIGINT NOT NULL,
    mime_type VARCHAR(150) NOT NULL,
    scan_status VARCHAR(20) NOT NULL DEFAULT 'pending', -- pending|clean|infected|error
    uploaded_by UUID NOT NULL REFERENCES users(id),
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE (document_id, version_number)
);

CREATE TABLE document_permissions (
    document_id UUID NOT NULL REFERENCES documents(id),
    role_scope VARCHAR(30) NOT NULL, -- e.g. project_role name this applies to, or user_id override
    user_id UUID REFERENCES users(id),
    can_view BOOLEAN NOT NULL DEFAULT true,
    can_edit BOOLEAN NOT NULL DEFAULT false,
    can_approve BOOLEAN NOT NULL DEFAULT false
);

CREATE TABLE tasks (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    project_id UUID NOT NULL REFERENCES projects(id),
    organization_id UUID NOT NULL,
    title VARCHAR(255) NOT NULL,
    description TEXT,
    status VARCHAR(30) NOT NULL DEFAULT 'todo', -- todo|in_progress|review|done
    priority VARCHAR(20) NOT NULL DEFAULT 'medium',
    assignee_id UUID REFERENCES users(id),
    due_date DATE,
    milestone_id UUID REFERENCES milestones(id),
    created_by UUID NOT NULL REFERENCES users(id),
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE comments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    task_id UUID REFERENCES tasks(id),
    document_id UUID REFERENCES documents(id),
    author_id UUID NOT NULL REFERENCES users(id),
    body TEXT NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    CHECK (num_nonnulls(task_id, document_id) = 1)
);

CREATE TABLE notifications (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    recipient_id UUID NOT NULL REFERENCES users(id),
    type VARCHAR(50) NOT NULL,
    payload JSONB NOT NULL,
    read_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE devices (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id),
    device_fingerprint TEXT NOT NULL,
    device_name VARCHAR(120),
    trusted BOOLEAN NOT NULL DEFAULT false,
    first_seen_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    last_seen_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    revoked_at TIMESTAMPTZ
);

CREATE TABLE sessions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id),
    device_id UUID NOT NULL REFERENCES devices(id),
    refresh_token_hash TEXT NOT NULL,   -- hashed, never store raw token
    ip_address INET NOT NULL,
    user_agent TEXT,
    issued_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    expires_at TIMESTAMPTZ NOT NULL,
    revoked_at TIMESTAMPTZ,
    rotated_from UUID REFERENCES sessions(id) -- refresh-token rotation chain, for replay detection
);

CREATE TABLE roles (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(50) UNIQUE NOT NULL -- system_admin, org_admin, project_admin, member, read_only, guest
);

CREATE TABLE permissions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    code VARCHAR(80) UNIQUE NOT NULL -- e.g. document.approve, project.member.remove
);

CREATE TABLE role_permissions (
    role_id UUID NOT NULL REFERENCES roles(id),
    permission_id UUID NOT NULL REFERENCES permissions(id),
    PRIMARY KEY (role_id, permission_id)
);

-- Tamper-evident: each row hash-chains to the previous row, so a DB-level UPDATE/DELETE
-- (including by a compromised app account or a rogue superuser) breaks the chain and is
-- detectable by an independent verifier that doesn't otherwise need write access to this table.
CREATE TABLE security_events (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES users(id),
    organization_id UUID,
    event_type VARCHAR(60) NOT NULL, -- login_failed, login_success, mfa_failed, lockout, permission_denied, ...
    severity VARCHAR(20) NOT NULL DEFAULT 'info',
    ip_address INET,
    metadata JSONB,
    seq BIGINT NOT NULL,                 -- strictly increasing, assigned from a dedicated sequence
    prev_hash CHAR(64) NOT NULL,         -- SHA-256 of the previous row's canonical fields (genesis: 64 zeros)
    row_hash CHAR(64) NOT NULL,          -- SHA-256(prev_hash || canonical(this row's fields))
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX security_events_seq_idx ON security_events(seq);
-- No UPDATE or DELETE grant is issued to the application DB role on this table (INSERT + SELECT only).
-- Corrections are handled by an additive "amendment" event referencing the original id, never by mutation.
REVOKE UPDATE, DELETE ON security_events FROM app_role;
```

**Chain computation**: `row_hash = SHA256(prev_hash || seq || event_type || user_id || organization_id || ip_address || metadata || created_at)`, computed application-side (in `security_service.py`, the only writer) immediately before insert, using the previous row's `row_hash` fetched under the same transaction (`SELECT ... FOR UPDATE` on the max-`seq` row to serialize concurrent writers and prevent fork/race in the chain).

**Verification**: a scheduled job (and the pre-go-live/quarterly DR-drill checklist) recomputes the chain from `seq=1` and confirms every `row_hash` matches — any break pinpoints the first tampered/missing row by `seq`. Verification only requires read access, so it can run from a separate, more tightly-scoped account than the app's own DB role.

**What this does and doesn't protect against**: it detects retroactive tampering or deletion of audit rows at the DB layer (including by someone with raw DB access) — it does not prevent an attacker with the app's own `security_service.py` code path from inserting a false-but-chain-valid event, and it does not protect confidentiality (rows are still plaintext, per Section 3's IP/metadata fields — this is an integrity control, not a secrecy one). For stronger guarantees, periodically export `(seq, row_hash)` checkpoints to write-once external storage (e.g., appended to the backup destination described in the DR plan) so even a full DB compromise + chain rewrite is detectable against an external reference point.

## 4. Row-Level Security
Every tenant-scoped table gets an RLS policy of the form:
```sql
ALTER TABLE projects ENABLE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON projects
  USING (organization_id = current_setting('app.current_org_id')::uuid
         OR id IN (SELECT project_id FROM project_partner_orgs
                    WHERE organization_id = current_setting('app.current_org_id')::uuid));
```
The backend sets `app.current_org_id` (and `app.current_user_id`) via `SET LOCAL` at the start of each transaction, derived only from the verified JWT — never from client-supplied headers/body. This is the second independent layer behind repository-level filtering.

## 5. Indexing Notes
- `messages(channel_id, created_at)` for chronological pagination.
- `documents(project_id, folder_path)` for folder browsing.
- `security_events(user_id, created_at)`, `security_events(event_type, created_at)` for SOC queries.
- Partial index `sessions(user_id) WHERE revoked_at IS NULL` for fast active-session lookups.
