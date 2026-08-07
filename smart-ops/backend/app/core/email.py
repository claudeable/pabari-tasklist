"""Fire-and-forget email notifications via Resend API."""

from __future__ import annotations

import logging

import httpx

from app.core.config import settings

logger = logging.getLogger(__name__)

_EMAIL_TEMPLATE = """
<div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto;background:#fff;border-radius:8px;overflow:hidden;border:1px solid #e5e7eb">
  <div style="background:#1e3a5f;padding:20px 24px">
    <p style="margin:0;color:#fff;font-size:18px;font-weight:700">Pabari Smart Ops</p>
  </div>
  <div style="padding:24px">
    <p style="margin:0 0 16px;font-size:15px;color:#111827">{body}</p>
    <a href="https://smart-ops.up.railway.app" style="display:inline-block;background:#1e3a5f;color:#fff;text-decoration:none;padding:10px 20px;border-radius:6px;font-size:14px">Open Smart Ops</a>
  </div>
  <div style="padding:12px 24px;background:#f9fafb;border-top:1px solid #e5e7eb">
    <p style="margin:0;font-size:12px;color:#6b7280">Pabari Group &mdash; Smart Operations Portal</p>
  </div>
</div>
"""


def send_notification_email(to: str, subject: str, body: str) -> None:
    """Send an email notification via Resend. Errors are logged but never raised."""
    if not settings.RESEND_ENABLED or not settings.RESEND_API_KEY:
        return
    try:
        httpx.post(
            "https://api.resend.com/emails",
            headers={"Authorization": f"Bearer {settings.RESEND_API_KEY}"},
            json={
                "from": settings.EMAIL_FROM,
                "to": [to],
                "subject": subject,
                "html": _EMAIL_TEMPLATE.format(body=body),
            },
            timeout=10.0,
        )
    except Exception as exc:
        logger.warning("Email send failed to %s: %s", to, exc)
