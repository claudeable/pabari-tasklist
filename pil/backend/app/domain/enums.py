from __future__ import annotations

import enum


class UserStatus(enum.StrEnum):
    active = "active"
    locked = "locked"
    disabled = "disabled"


class SystemRole(enum.StrEnum):
    system_admin = "system_admin"
    member = "member"


class OrgRole(enum.StrEnum):
    org_admin = "org_admin"
    member = "member"


class ProjectRole(enum.StrEnum):
    project_admin = "project_admin"
    member = "member"
    read_only = "read_only"
    guest = "guest"


class SecurityEventType(enum.StrEnum):
    login_success = "login_success"
    login_failed = "login_failed"
    mfa_failed = "mfa_failed"
    mfa_success = "mfa_success"
    lockout = "lockout"
    permission_denied = "permission_denied"
    password_changed = "password_changed"
    session_revoked = "session_revoked"
    device_revoked = "device_revoked"
    refresh_token_reuse_detected = "refresh_token_reuse_detected"
    admin_action = "admin_action"


class SecurityEventSeverity(enum.StrEnum):
    info = "info"
    warning = "warning"
    critical = "critical"
