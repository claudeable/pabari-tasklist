// Typed fetch wrapper for the FastAPI backend.
// Base URL comes from NEXT_PUBLIC_API_URL, falling back to the local dev backend.

import { clearSignedIn } from "@/lib/auth";
import type {
  ActivityReport,
  AppNotification,
  Channel,
  ChannelMessage,
  DashboardSummary,
  Decision,
  Deliverable,
  DocumentRecord,
  Drawing,
  DrawingComment,
  KbArticle,
  LoginResponse,
  Meeting,
  Milestone,
  Organization,
  Project,
  ProjectParticipant,
  ProjectProgressReport,
  Risk,
  RisksSummaryReport,
  Role,
  SiteReport,
  Task,
  TasksSummaryReport,
  TaskUpdateEntry,
  UnreadCount,
  UpdateMePayload,
  User,
} from "@/lib/types";

export const API_BASE_URL =
  process.env.NEXT_PUBLIC_API_URL?.replace(/\/+$/, "") || "https://smart-ops-backend-production-4fe9.up.railway.app/api/v1";

export class ApiError extends Error {
  status: number;
  constructor(message: string, status: number) {
    super(message);
    this.name = "ApiError";
    this.status = status;
  }
}

interface RequestOptions extends Omit<RequestInit, "body"> {
  body?: unknown;
  auth?: boolean;
}

const PABARI_URL = "https://pabari-workspace.up.railway.app";

async function silentReauth(): Promise<boolean> {
  try {
    // Ask Pabari for a new SSO token (cross-origin, uses the Pabari session cookie)
    const tokenRes = await fetch(`${PABARI_URL}/api/sso/token`, {
      method: "POST",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ portal: "smartops" }),
    });
    if (!tokenRes.ok) return false;
    const { redirect_url } = await tokenRes.json();
    if (!redirect_url) return false;
    const pabariToken = new URL(redirect_url).searchParams.get("token");
    if (!pabariToken) return false;

    // Exchange the Pabari token for a fresh Smart Ops session cookie
    const ssoRes = await fetch(`${API_BASE_URL}/auth/sso`, {
      method: "POST",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ pabari_token: pabariToken }),
    });
    return ssoRes.ok;
  } catch {
    return false;
  }
}

async function request<T>(path: string, options: RequestOptions = {}): Promise<T> {
  // `auth` is accepted for backwards compatibility with existing call sites
  // but no longer changes behavior: authorization is carried by the
  // httpOnly cookie the backend sets on login, which the browser attaches
  // automatically to every credentialed request below.
  const { body, headers, ...rest } = options;

  const finalHeaders: Record<string, string> = {
    Accept: "application/json",
    ...(headers as Record<string, string>),
  };

  if (body !== undefined) {
    finalHeaders["Content-Type"] = "application/json";
  }

  let response: Response;
  try {
    response = await fetch(`${API_BASE_URL}${path}`, {
      ...rest,
      credentials: "include",
      headers: finalHeaders,
      body: body !== undefined ? JSON.stringify(body) : undefined,
    });
  } catch {
    throw new ApiError(
      "Could not reach the server. Please check your connection and try again.",
      0,
    );
  }

  if (response.status === 401 && !path.includes("/auth/")) {
    // Try to silently re-auth via Pabari SSO before giving up
    const refreshed = await silentReauth();
    if (refreshed) {
      // Retry original request once with the new session
      return request<T>(path, options);
    }
    clearSignedIn();
    window.location.href = "https://pabari-workspace.up.railway.app";
    throw new ApiError("Session expired", 401);
  }

  if (!response.ok) {
    let message = `Request failed (${response.status})`;
    try {
      const data = await response.json();
      message = data?.detail || data?.message || message;
    } catch {
      // ignore body parse errors
    }
    throw new ApiError(message, response.status);
  }

  if (response.status === 204) {
    return undefined as T;
  }

  return (await response.json()) as T;
}

export const api = {
  login: (email: string, password: string) =>
    request<LoginResponse>("/auth/login", {
      method: "POST",
      body: { email, password },
    }),
  ssoLogin: (pabariToken: string) =>
    request<LoginResponse>("/auth/sso", {
      method: "POST",
      body: { pabari_token: pabariToken },
    }),
  logout: () => request<{ status: string }>("/auth/logout", { method: "POST" }),
  me: () => request<User>("/auth/me"),
  dashboardSummary: () => request<DashboardSummary>("/dashboard/summary"),
  organizations: () => request<Organization[]>("/organizations"),
  organization: (id: string) => request<Organization>(`/organizations/${id}`),
  createOrganization: (payload: Partial<Organization>) =>
    request<Organization>("/organizations", { method: "POST", body: payload }),
  updateOrganization: (id: string, payload: Partial<Organization>) =>
    request<Organization>(`/organizations/${id}`, { method: "PUT", body: payload }),
  deleteOrganization: (id: string) =>
    request<void>(`/organizations/${id}`, { method: "DELETE" }),
  projects: () => request<Project[]>("/projects"),
  project: (id: string) => request<Project>(`/projects/${id}`),
  createProject: (payload: Partial<Project>) =>
    request<Project>("/projects", { method: "POST", body: payload }),
  updateProject: (id: string, payload: Partial<Project>) =>
    request<Project>(`/projects/${id}`, { method: "PUT", body: payload }),
  deleteProject: (id: string) => request<void>(`/projects/${id}`, { method: "DELETE" }),
  updateMe: (payload: UpdateMePayload) =>
    request<User>("/users/me", { method: "PUT", body: payload }),
  users: () => request<User[]>("/users"),
  roles: () => request<Role[]>("/roles"),

  // Milestones
  milestones: (projectId?: string) =>
    request<Milestone[]>(`/milestones${projectId ? `?project_id=${projectId}` : ""}`),
  createMilestone: (payload: Partial<Milestone>) =>
    request<Milestone>("/milestones", { method: "POST", body: payload }),
  updateMilestone: (id: string, payload: Partial<Milestone>) =>
    request<Milestone>(`/milestones/${id}`, { method: "PUT", body: payload }),
  deleteMilestone: (id: string) => request<void>(`/milestones/${id}`, { method: "DELETE" }),

  // Deliverables
  deliverables: (projectId?: string) =>
    request<Deliverable[]>(`/deliverables${projectId ? `?project_id=${projectId}` : ""}`),
  createDeliverable: (payload: Partial<Deliverable>) =>
    request<Deliverable>("/deliverables", { method: "POST", body: payload }),
  updateDeliverable: (id: string, payload: Partial<Deliverable>) =>
    request<Deliverable>(`/deliverables/${id}`, { method: "PUT", body: payload }),
  deleteDeliverable: (id: string) => request<void>(`/deliverables/${id}`, { method: "DELETE" }),

  // Risks
  risks: (projectId?: string) =>
    request<Risk[]>(`/risks${projectId ? `?project_id=${projectId}` : ""}`),
  createRisk: (payload: Partial<Risk>) =>
    request<Risk>("/risks", { method: "POST", body: payload }),
  updateRisk: (id: string, payload: Partial<Risk>) =>
    request<Risk>(`/risks/${id}`, { method: "PUT", body: payload }),
  deleteRisk: (id: string) => request<void>(`/risks/${id}`, { method: "DELETE" }),

  // Decisions
  decisions: (projectId?: string) =>
    request<Decision[]>(`/decisions${projectId ? `?project_id=${projectId}` : ""}`),
  createDecision: (payload: Partial<Decision>) =>
    request<Decision>("/decisions", { method: "POST", body: payload }),
  updateDecision: (id: string, payload: Partial<Decision>) =>
    request<Decision>(`/decisions/${id}`, { method: "PUT", body: payload }),
  deleteDecision: (id: string) => request<void>(`/decisions/${id}`, { method: "DELETE" }),

  // Project participants
  projectParticipants: (projectId?: string) =>
    request<ProjectParticipant[]>(
      `/project-participants${projectId ? `?project_id=${projectId}` : ""}`,
    ),
  createProjectParticipant: (payload: Partial<ProjectParticipant>) =>
    request<ProjectParticipant>("/project-participants", { method: "POST", body: payload }),
  deleteProjectParticipant: (id: string) =>
    request<void>(`/project-participants/${id}`, { method: "DELETE" }),

  // Documents
  documents: (projectId?: string) =>
    request<DocumentRecord[]>(`/documents${projectId ? `?project_id=${projectId}` : ""}`),
  document: (id: string) => request<DocumentRecord>(`/documents/${id}`),
  createDocument: (payload: Partial<DocumentRecord>) =>
    request<DocumentRecord>("/documents", { method: "POST", body: payload }),
  updateDocument: (id: string, payload: Partial<DocumentRecord>) =>
    request<DocumentRecord>(`/documents/${id}`, { method: "PUT", body: payload }),
  deleteDocument: (id: string) => request<void>(`/documents/${id}`, { method: "DELETE" }),

  // Tasks
  tasks: (projectId?: string) =>
    request<Task[]>(`/tasks${projectId ? `?project_id=${projectId}` : ""}`),
  task: (id: string) => request<Task>(`/tasks/${id}`),
  createTask: (payload: Partial<Task>) =>
    request<Task>("/tasks", { method: "POST", body: payload }),
  updateTask: (id: string, payload: Partial<Task>) =>
    request<Task>(`/tasks/${id}`, { method: "PUT", body: payload }),
  deleteTask: (id: string) => request<void>(`/tasks/${id}`, { method: "DELETE" }),
  taskUpdates: (taskId: string) => request<TaskUpdateEntry[]>(`/tasks/${taskId}/updates`),
  postTaskUpdate: (taskId: string, description: string) =>
    request<TaskUpdateEntry>(`/tasks/${taskId}/updates`, {
      method: "POST",
      body: { description },
    }),
  taskHkComments: (taskId: string) =>
    request<TaskUpdateEntry[]>(`/tasks/${taskId}/hk-comments`),
  postTaskHkComment: (taskId: string, description: string) =>
    request<TaskUpdateEntry>(`/tasks/${taskId}/hk-comments`, {
      method: "POST",
      body: { description },
    }),

  // Meetings
  meetings: (projectId?: string) =>
    request<Meeting[]>(`/meetings${projectId ? `?project_id=${projectId}` : ""}`),
  meeting: (id: string) => request<Meeting>(`/meetings/${id}`),
  createMeeting: (payload: Partial<Meeting>) =>
    request<Meeting>("/meetings", { method: "POST", body: payload }),
  updateMeeting: (id: string, payload: Partial<Meeting>) =>
    request<Meeting>(`/meetings/${id}`, { method: "PUT", body: payload }),
  deleteMeeting: (id: string) => request<void>(`/meetings/${id}`, { method: "DELETE" }),

  // Communication
  channels: (projectId?: string) =>
    request<Channel[]>(`/channels${projectId ? `?project_id=${projectId}` : ""}`),
  createChannel: (payload: Partial<Channel>) =>
    request<Channel>("/channels", { method: "POST", body: payload }),
  channelMessages: (channelId: string) =>
    request<ChannelMessage[]>(`/channels/${channelId}/messages`),
  sendChannelMessage: (channelId: string, payload: Partial<ChannelMessage>) =>
    request<ChannelMessage>(`/channels/${channelId}/messages`, {
      method: "POST",
      body: payload,
    }),
  directChannels: () => request<Channel[]>("/channels/direct"),
  createDirectChannel: (otherUserId: string) =>
    request<Channel>("/channels/direct", {
      method: "POST",
      body: { other_user_id: otherUserId },
    }),

  // Presence
  pingPresence: () => request<void>("/presence/ping", { method: "POST" }),

  // Engineering
  drawings: (projectId?: string) =>
    request<Drawing[]>(`/drawings${projectId ? `?project_id=${projectId}` : ""}`),
  drawing: (id: string) => request<Drawing>(`/drawings/${id}`),
  createDrawing: (payload: Partial<Drawing>) =>
    request<Drawing>("/drawings", { method: "POST", body: payload }),
  updateDrawing: (id: string, payload: Partial<Drawing>) =>
    request<Drawing>(`/drawings/${id}`, { method: "PUT", body: payload }),
  deleteDrawing: (id: string) => request<void>(`/drawings/${id}`, { method: "DELETE" }),
  createDrawingComment: (drawingId: string, payload: Partial<DrawingComment>) =>
    request<DrawingComment>(`/drawings/${drawingId}/comments`, {
      method: "POST",
      body: payload,
    }),

  // Site Progress
  siteReports: (projectId?: string) =>
    request<SiteReport[]>(`/site-reports${projectId ? `?project_id=${projectId}` : ""}`),
  createSiteReport: (payload: Partial<SiteReport>) =>
    request<SiteReport>("/site-reports", { method: "POST", body: payload }),
  deleteSiteReport: (id: string) => request<void>(`/site-reports/${id}`, { method: "DELETE" }),

  // Knowledge Base
  kbArticles: (params?: { category?: string; q?: string }) => {
    const search = new URLSearchParams();
    if (params?.category) search.set("category", params.category);
    if (params?.q) search.set("q", params.q);
    const qs = search.toString();
    return request<KbArticle[]>(`/kb-articles${qs ? `?${qs}` : ""}`);
  },
  kbArticle: (id: string) => request<KbArticle>(`/kb-articles/${id}`),
  createKbArticle: (payload: Partial<KbArticle>) =>
    request<KbArticle>("/kb-articles", { method: "POST", body: payload }),

  // Notifications
  notifications: () => request<AppNotification[]>("/notifications"),
  unreadNotificationsCount: () => request<UnreadCount>("/notifications/unread-count"),
  markNotificationRead: (id: string) =>
    request<AppNotification>(`/notifications/${id}/read`, { method: "PUT" }),
  markAllNotificationsRead: () =>
    request<void>("/notifications/read-all", { method: "PUT" }),

  // Reports
  projectProgressReport: () => request<ProjectProgressReport>("/reports/project-progress"),
  tasksSummaryReport: () => request<TasksSummaryReport>("/reports/tasks-summary"),
  risksSummaryReport: () => request<RisksSummaryReport>("/reports/risks-summary"),
  activityReport: () => request<ActivityReport>("/reports/activity"),
};
