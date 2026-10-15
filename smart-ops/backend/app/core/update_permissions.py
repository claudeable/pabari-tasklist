"""Moderation rights for project updates, remarks, attachments and comments."""

from fastapi import HTTPException


def can_moderate_updates(user):
    if (user.email or "").strip().lower() == "hkotecha@kwale-group.com":
        return True
    role = user.role
    return bool(role and (
        (role.name or "").strip().lower() in {"admin", "administrator", "super admin", "superadmin"}
        or any(p.code == "admin" for p in role.permissions)
    ))


def require_update_moderator(user):
    if not can_moderate_updates(user):
        raise HTTPException(status_code=403, detail="Only Harshil and administrators can edit or delete updates and comments")
