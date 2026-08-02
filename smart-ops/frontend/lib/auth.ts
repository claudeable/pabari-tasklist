// Session-flag helper.
//
// The real JWT lives in an httpOnly cookie set by the backend (POST
// /auth/login on the API's own domain) — it is never readable by
// client-side JS, so it can't be exfiltrated via XSS. The browser sends it
// automatically on every credentialed fetch to the API (see api-client.ts's
// `credentials: "include"`).
//
// This module only manages a small, non-sensitive flag cookie on the
// frontend's own domain so Next.js middleware (which can't see the
// backend's cross-domain cookie) can do a UX-level redirect for
// logged-out users. It grants no access by itself — every real request is
// still authorized independently by the backend via the httpOnly cookie.

import Cookies from "js-cookie";

export const SESSION_FLAG_COOKIE = "jcp_session";

export function markSignedIn() {
  Cookies.set(SESSION_FLAG_COOKIE, "1", {
    expires: 7,
    sameSite: "lax",
    secure: typeof window !== "undefined" && window.location.protocol === "https:",
  });
}

export function isSignedIn(): boolean {
  return Cookies.get(SESSION_FLAG_COOKIE) === "1";
}

export function clearSignedIn() {
  Cookies.remove(SESSION_FLAG_COOKIE);
}
