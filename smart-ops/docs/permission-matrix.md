# RBAC Permission Matrix

Legend: **V**iew · **C**reate · **E**dit · **A**pprove · **D**elete · — none

Roles are global (one role per user in this pass); a future iteration may allow per-project role overrides for cross-org participants (e.g. a Partner Representative who is Viewer on most projects but Editor on one).

| Module | Sys Admin | Org Admin | Project Director | Project Manager | Engineer | Site Engineer | Finance Observer | Procurement Observer | Quality Officer | HSE Officer | Client Rep | Partner Rep | Viewer | Guest |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| Organizations | VCEAD | VCE (own org) | V | V | V | V | V | V | V | V | V | V | V | — |
| Projects | VCEAD | VCEAD | VCEAD | VCE | V | V | V | V | V | V | V | V | V | V (assigned) |
| Communication | VCEAD | VCE | VCE | VCE | VCE | VCE | V | V | VCE | VCE | VCE | VCE | V | V (assigned) |
| Documents | VCEAD | VCEAD | VCEA | VCEA | VC | VC | V | V | VCEA | VC | V | V | V | V (assigned) |
| Tasks | VCEAD | VCEAD | VCEAD | VCEAD | VCE (own) | VCE (own) | V | V | V | V | V | V | V | V (assigned) |
| Meetings | VCEAD | VCEAD | VCEAD | VCEAD | VC | VC | V | V | VC | VC | VC | VC | V | V (assigned) |
| Engineering | VCEAD | VCEAD | VA | VA | VCEA | VCE | — | — | VCEA | V | V | V | V | — |
| Site Progress | VCEAD | VCEAD | VA | VA | V | VCE | — | — | VA | VCEA | V | V | V | — |
| Reports | VCEAD | VCEAD | VC | VC | V | V | V | V | V | V | V | V | V | — |
| Knowledge Base | VCEAD | VCEAD | VCE | VCE | VC | VC | V | V | VCE | VCE | V | V | V | V |
| Notifications | VCEAD | VCE | VE (own) | VE (own) | VE (own) | VE (own) | VE (own) | VE (own) | VE (own) | VE (own) | VE (own) | VE (own) | VE (own) | VE (own) |
| Settings | VCEAD | VCE (own org) | — | — | — | — | — | — | — | — | — | — | — | — |
| Audit Logs | V | V (own org) | — | — | — | — | — | — | — | — | — | — | — | — |

## Enforcement
- Backend: every mutating endpoint is guarded by `require_permission("<module>.<action>")` (see `app/core/deps.py`), backed by the `Role` → `RolePermission` → `Permission` tables seeded in `app/seed.py`.
- "(own)" qualifiers (e.g. Engineer edits own tasks) are row-level checks layered on top of the coarse role permission and must be enforced in the endpoint handler, not just the permission table — flagged as a roadmap item until Tasks/Documents get real endpoints.
- "(assigned)" for Client Rep / Partner Rep / Guest means scoped to projects where they appear in `ProjectParticipant` — also a row-level check to add when those modules go live.
