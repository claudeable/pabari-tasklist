import { apiFetch, ApiError } from "@/lib/api-client";

interface MeResponse {
  id: string;
  alias: string;
}

interface OrganizationResponse {
  id: string;
  name: string;
}

interface ProjectResponse {
  id: string;
  organization_id: string;
  name: string;
}

interface ChannelResponse {
  id: string;
  project_id: string;
  name: string;
}

export interface DefaultWorkspace {
  organizationId: string;
  projectId: string;
  channelId: string;
}

const STORAGE_KEY = "scv_default_workspace";

let cachedWorkspace: DefaultWorkspace | null = null;
let inFlight: Promise<DefaultWorkspace> | null = null;

function readCachedFromStorage(): DefaultWorkspace | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = sessionStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (parsed && parsed.organizationId && parsed.projectId && parsed.channelId) return parsed;
  } catch {
    // ignore malformed/inaccessible storage
  }
  return null;
}

function writeCacheToStorage(workspace: DefaultWorkspace): void {
  if (typeof window === "undefined") return;
  try {
    sessionStorage.setItem(STORAGE_KEY, JSON.stringify(workspace));
  } catch {
    // storage full/unavailable — in-memory cache still works for this tab session
  }
}

async function resolveWorkspace(): Promise<DefaultWorkspace> {
  const me = await apiFetch<MeResponse>("/api/v1/users/me");

  let orgs = await apiFetch<OrganizationResponse[]>("/api/v1/organizations");
  let org = orgs[0];
  if (!org) {
    org = await apiFetch<OrganizationResponse>("/api/v1/organizations", {
      method: "POST",
      body: JSON.stringify({ name: `${me.alias}'s Workspace`, initial_admin_user_id: me.id }),
    });
  }

  let projects = await apiFetch<ProjectResponse[]>(`/api/v1/organizations/${org.id}/projects`);
  let project = projects[0];
  if (!project) {
    project = await apiFetch<ProjectResponse>(`/api/v1/organizations/${org.id}/projects`, {
      method: "POST",
      body: JSON.stringify({ name: "General", description: null }),
    });
  }

  let channels = await apiFetch<ChannelResponse[]>(`/api/v1/projects/${project.id}/channels`);
  let channel = channels[0];
  if (!channel) {
    channel = await apiFetch<ChannelResponse>(`/api/v1/projects/${project.id}/channels`, {
      method: "POST",
      body: JSON.stringify({ name: "general", is_private: false }),
    });
  }

  return { organizationId: org.id, projectId: project.id, channelId: channel.id };
}

/**
 * Every module (chat/tasks/documents) needs an org+project to live under. Rather
 * than making the user set that up by hand, silently create a single default
 * workspace the first time they land here, then always resolve to it.
 *
 * The resolution chain is 3 sequential round-trips (org -> project -> channel), so
 * re-running it on every single module navigation made switching modules feel like
 * the click wasn't registering. The workspace never changes for a session, so it's
 * cached in memory (survives client-side navigation) and sessionStorage (survives a
 * full page reload) instead of re-resolved every time.
 */
function clearCache(): void {
  cachedWorkspace = null;
  if (typeof window !== "undefined") {
    try {
      sessionStorage.removeItem(STORAGE_KEY);
    } catch {
      // ignore
    }
  }
}

/** Confirms a cached project id still exists server-side. Server-side data can
 * change (an admin cleanup, a deleted project) out from under a cache that
 * otherwise lives for the whole tab session — without this, a stale cache would
 * 404 every project-scoped call until the user manually cleared storage. */
async function isStillValid(ws: DefaultWorkspace): Promise<boolean> {
  try {
    await apiFetch(`/api/v1/projects/${ws.projectId}`);
    return true;
  } catch (err) {
    if (err instanceof ApiError && err.status === 404) return false;
    return true; // a transient/network error shouldn't force a full re-resolve
  }
}

async function resolveAndCache(): Promise<DefaultWorkspace> {
  if (!inFlight) {
    inFlight = resolveWorkspace()
      .then((ws) => {
        cachedWorkspace = ws;
        writeCacheToStorage(ws);
        return ws;
      })
      .finally(() => {
        inFlight = null;
      });
  }
  return inFlight;
}

export async function ensureDefaultWorkspace(): Promise<DefaultWorkspace> {
  const cached = cachedWorkspace ?? readCachedFromStorage();
  if (cached) {
    if (await isStillValid(cached)) {
      cachedWorkspace = cached;
      return cached;
    }
    clearCache();
  }
  return resolveAndCache();
}
