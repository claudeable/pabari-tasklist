# Entity Relationship Diagram — Smart Ops Portal

Covers the full data model, including tables backing modules that are UI-stubbed in this pass (Documents, Tasks, Meetings, Notifications), so no migration rework is needed when those modules are built out.

```mermaid
erDiagram
    ORGANIZATION ||--o{ DEPARTMENT : has
    ORGANIZATION ||--o{ USER : employs
    ORGANIZATION ||--o{ PROJECT_PARTICIPANT : "involved in"
    ORGANIZATION ||--o{ DOCUMENT : owns
    ROLE ||--o{ USER : "assigned to"
    ROLE ||--o{ ROLE_PERMISSION : grants
    PERMISSION ||--o{ ROLE_PERMISSION : "granted via"

    PROJECT ||--o{ PROJECT_PARTICIPANT : has
    PROJECT ||--o{ MILESTONE : has
    PROJECT ||--o{ DELIVERABLE : has
    PROJECT ||--o{ RISK : has
    PROJECT ||--o{ DECISION : has
    PROJECT ||--o{ ACTIVITY_LOG : has
    PROJECT ||--o{ DOCUMENT : has
    PROJECT ||--o{ TASK : has
    PROJECT ||--o{ MEETING : has

    MILESTONE ||--o{ DELIVERABLE : groups
    USER ||--o{ PROJECT_PARTICIPANT : "participates as"
    USER ||--o{ TASK : owns
    USER ||--o{ RISK : owns
    USER ||--o{ DECISION : decides
    USER ||--o{ DOCUMENT : uploads
    USER ||--o{ NOTIFICATION : receives
    USER ||--o{ ACTIVITY_LOG : performs
    DEPARTMENT ||--o{ USER : contains

    ORGANIZATION {
        uuid id PK
        string name
        string logo_url
        string industry
        string website
        string address
        string primary_contact_name
        string primary_contact_email
        string primary_contact_phone
        timestamp created_at
    }
    DEPARTMENT {
        uuid id PK
        uuid organization_id FK
        string name
        string description
    }
    ROLE {
        uuid id PK
        string name
        string description
    }
    PERMISSION {
        uuid id PK
        string code
        string description
    }
    ROLE_PERMISSION {
        uuid role_id FK
        uuid permission_id FK
    }
    USER {
        uuid id PK
        uuid organization_id FK
        uuid department_id FK
        uuid role_id FK
        string full_name
        string email
        string phone
        string title
        string avatar_url
        string hashed_password
        bool is_active
        timestamp created_at
    }
    PROJECT {
        uuid id PK
        string name
        string code
        string description
        enum status
        enum health
        date start_date
        date end_date
        numeric budget_amount
        string budget_currency
        timestamp created_at
    }
    PROJECT_PARTICIPANT {
        uuid id PK
        uuid project_id FK
        uuid organization_id FK
        uuid user_id FK
        string role_on_project
    }
    MILESTONE {
        uuid id PK
        uuid project_id FK
        string title
        string description
        date due_date
        enum status
        timestamp completed_at
    }
    DELIVERABLE {
        uuid id PK
        uuid project_id FK
        uuid milestone_id FK
        string title
        string description
        enum status
        date due_date
        uuid owner_user_id FK
    }
    RISK {
        uuid id PK
        uuid project_id FK
        string title
        string description
        enum severity
        enum likelihood
        enum status
        uuid owner_user_id FK
        timestamp created_at
    }
    DECISION {
        uuid id PK
        uuid project_id FK
        string title
        string description
        uuid decided_by_user_id FK
        date decision_date
        enum status
    }
    ACTIVITY_LOG {
        uuid id PK
        uuid project_id FK
        uuid organization_id FK
        uuid user_id FK
        string action
        string entity_type
        string entity_id
        string description
        timestamp created_at
    }
    DOCUMENT {
        uuid id PK
        uuid project_id FK
        uuid organization_id FK
        string folder
        string name
        string file_url
        int version
        string status
        uuid uploaded_by_user_id FK
        timestamp created_at
    }
    TASK {
        uuid id PK
        uuid project_id FK
        string title
        string description
        string priority
        string status
        uuid owner_user_id FK
        uuid assigned_organization_id FK
        date due_date
        int progress_percent
        timestamp created_at
    }
    MEETING {
        uuid id PK
        uuid project_id FK
        string title
        timestamp scheduled_at
        string status
        timestamp created_at
    }
    NOTIFICATION {
        uuid id PK
        uuid user_id FK
        string type
        string title
        string body
        bool is_read
        timestamp created_at
    }
```

## Notes
- All primary keys are UUIDs (`gen_random_uuid()`), suitable for multi-org, multi-project scale without ID collisions across future data imports.
- `ACTIVITY_LOG` is intentionally generic (`entity_type` + `entity_id`) so any future module can log into it without a schema change.
- `DOCUMENT`, `TASK`, `MEETING`, `NOTIFICATION` are present now as placeholder tables (referenced by the Dashboard summary endpoint for counts) but have no dedicated CRUD API yet — see `roadmap.md`.
