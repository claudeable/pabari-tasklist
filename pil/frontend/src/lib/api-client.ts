/**
 * Thin API client. Access token is held only in a module-level variable (memory),
 * never in localStorage/sessionStorage — an XSS payload that can run JS can still
 * read an in-memory token, but not one persisted to storage that survives reload
 * and is trivially exfiltrated in bulk (Authentication Design doc §5).
 *
 * Refresh token lives in an httpOnly cookie the browser sends automatically; this
 * client never touches it directly. CSRF token is read from a non-httpOnly cookie
 * and echoed on every mutating request (Security Architecture doc §4).
 */

const API_BASE_URL = process.env.NEXT_PUBLIC_API_BASE_URL ?? "";

let accessToken: string | null = null;

export function setAccessToken(token: string | null): void {
  accessToken = token;
}

function readCsrfCookie(): string | null {
  const match = document.cookie.match(/(?:^|; )scv_csrf=([^;]*)/);
  return match?.[1] ? decodeURIComponent(match[1]) : null;
}

const MUTATING_METHODS = new Set(["POST", "PATCH", "PUT", "DELETE"]);

/** Raw fetch with auth/CSRF headers attached but no response parsing — for binary
 * downloads or other non-JSON responses where apiFetch's `.json()` would break. */
export async function apiFetchRaw(
  path: string,
  init: RequestInit & { method?: string; bearerToken?: string } = {},
): Promise<Response> {
  const method = (init.method ?? "GET").toUpperCase();
  const headers = new Headers(init.headers);

  // bearerToken lets a caller use a short-lived, single-purpose challenge token
  // (password-change-required / mfa-enrollment-required) instead of the normal
  // session access token — those two are never interchangeable server-side (Threat
  // Model §3.1), so this is only ever set for the specific forced-flow requests.
  const tokenToUse = init.bearerToken ?? accessToken;
  if (tokenToUse) {
    headers.set("Authorization", `Bearer ${tokenToUse}`);
  }
  if (MUTATING_METHODS.has(method)) {
    const csrf = readCsrfCookie();
    if (csrf) headers.set("X-CSRF-Token", csrf);
  }
  // FormData sets its own multipart boundary via Content-Type; letting fetch
  // handle that itself is required — setting it manually breaks the boundary.
  if (init.body && !(init.body instanceof FormData) && !headers.has("Content-Type")) {
    headers.set("Content-Type", "application/json");
  }

  const { bearerToken: _bearerToken, ...fetchInit } = init;
  return fetch(`${API_BASE_URL}${path}`, {
    ...fetchInit,
    method,
    headers,
    credentials: "include", // sends the httpOnly refresh cookie where applicable
    cache: "no-store",
  });
}

let refreshInFlight: Promise<boolean> | null = null;

/**
 * Access tokens expire after 15 minutes and only ever live in memory, so a page
 * reload, a new tab, or just sitting on a page for a while all wipe it out even
 * though the httpOnly refresh cookie is still perfectly valid — this silently
 * exchanges it for a new access token. Deduped so concurrent 401s (e.g. a page
 * firing several requests at once) only trigger one refresh call, not one per
 * request.
 */
async function tryRefresh(): Promise<boolean> {
  if (!refreshInFlight) {
    refreshInFlight = (async () => {
      try {
        // Must go through apiFetchRaw, not a bare fetch() — refresh is a POST, and
        // the CSRF middleware rejects any mutating request missing the X-CSRF-Token
        // header, regardless of how valid the refresh cookie itself is. A bare
        // fetch() here silently 403'd every single refresh attempt, which is why
        // "logged out on reload" kept happening even after the cookie/proxy fix.
        const response = await apiFetchRaw("/api/v1/auth/refresh", { method: "POST" });
        if (!response.ok) return false;
        const data = (await response.json()) as { access_token: string };
        setAccessToken(data.access_token);
        return true;
      } catch {
        return false;
      } finally {
        refreshInFlight = null;
      }
    })();
  }
  return refreshInFlight;
}

const NO_REFRESH_PATHS = new Set(["/api/v1/auth/login", "/api/v1/auth/refresh", "/api/v1/auth/logout"]);

export async function apiFetch<T>(
  path: string,
  init: RequestInit & { method?: string; bearerToken?: string } = {},
): Promise<T> {
  let response = await apiFetchRaw(path, init);

  // Don't try to silently refresh for the auth endpoints themselves, or for a
  // bearerToken (challenge-token) call — those 401s are meaningful failures
  // (wrong password, expired challenge), not "your session just needs renewing."
  if (response.status === 401 && !init.bearerToken && !NO_REFRESH_PATHS.has(path)) {
    const refreshed = await tryRefresh();
    if (refreshed) {
      response = await apiFetchRaw(path, init);
    }
  }

  if (!response.ok) {
    const problem = await response.json().catch(() => null);
    // `detail` is only ever populated by the backend for errors it deliberately
    // wrote a specific, safe message for (AppError subclasses) — the generic
    // catch-all 500 handler never includes one, by design, to avoid leaking
    // internals. So preferring it over the generic `title` here is safe and
    // shows the user the actually useful message when one exists.
    throw new ApiError(response.status, problem?.detail ?? problem?.title ?? "Request failed", problem);
  }

  if (response.status === 204) return undefined as T;
  return (await response.json()) as T;
}

export class ApiError extends Error {
  constructor(
    public status: number,
    message: string,
    public problem: unknown,
  ) {
    super(message);
    this.name = "ApiError";
  }
}
