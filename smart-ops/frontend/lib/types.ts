// Shared TypeScript types mirroring the FastAPI backend contract
// (Smart Ops Portal)

export interface User {
  id: string;
  email: string;
  full_name?: string;
  name?: string;
  // GET /auth/me returns a nested role object; some list endpoints may
  // return a plain role name string — support both.
  role?: string | Role;
  title?: string;
  organization_id?: string;
  organization_name?: string;
  avatar_url?: string;
  last_seen_at?: string | null;
  [key: string]: unknown;
}

export interface LoginResponse {
  access_token: string;
  token_type: string;
}

export interface Organization {
  id: string;
  name: string;
  logo_url?: string;
  description?: string;
  industry?: string;
  website?: string;
  address?: string;
  primary_contact_name?: string;
  primary_contact_email?: string;
  primary_contact_phone?: string;
  primary_contact?: string;
  project_count?: number;
  departments?: Department[];
  users?: OrgUser[];
  roles?: RolePermission[];
  contacts?: ContactDirectoryEntry[];
  projects?: ProjectRef[];
  [key: string]: unknown;
}

export interface Department {
  id: string;
  name: string;
  head?: string;
  member_count?: number;
}

export interface OrgUser {
  id: string;
  name: string;
  email?: string;
  role?: string;
  department?: string;
  avatar_url?: string;
}

export interface RolePermission {
  id: string;
  role: string;
  permissions?: string[];
  description?: string;
}

export interface ContactDirectoryEntry {
  id: string;
  name: string;
  title?: string;
  email?: string;
  phone?: string;
}

export interface ProjectRef {
  id: string;
  name: string;
  status?: string;
}

export type ProjectStatus =
  | "planning"
  | "active"
  | "on_hold"
  | "completed"
  | "cancelled"
  | string;

export type ProjectHealth = "on_track" | "at_risk" | "off_track" | "delayed" | string;

export interface Project {
  id: string;
  name: string;
  code?: string;
  description?: string;
  status?: ProjectStatus;
  health?: ProjectHealth;
  progress?: number;
  start_date?: string;
  end_date?: string;
  budget?: number;
  budget_amount?: number;
  budget_currency?: string;
  spent_budget?: number;
  organizations?: ProjectRef[];
  timeline?: TimelineEvent[];
  milestones?: Milestone[];
  deliverables?: Deliverable[];
  participants?: OrgUser[];
  activity?: ActivityItem[];
  risks?: Risk[];
  decisions?: Decision[];
  [key: string]: unknown;
}

export interface TimelineEvent {
  id: string;
  title: string;
  date: string;
  description?: string;
}

export type MilestoneStatus = "pending" | "in_progress" | "completed" | "delayed" | string;

export interface Milestone {
  id: string;
  title: string;
  name?: string;
  description?: string;
  due_date?: string;
  status?: MilestoneStatus;
  project_id?: string;
  project_name?: string;
  [key: string]: unknown;
}

export type DeliverableStatus = "pending" | "in_progress" | "completed" | "delayed" | string;

export interface Deliverable {
  id: string;
  project_id?: string;
  milestone_id?: string;
  title: string;
  description?: string;
  status?: DeliverableStatus;
  due_date?: string;
  owner?: string;
  owner_user_id?: string;
  owner_name?: string;
  [key: string]: unknown;
}

export interface ActivityItem {
  id: string;
  actor?: string;
  actor_name?: string;
  action?: string;
  description?: string;
  message?: string;
  timestamp?: string;
  created_at?: string;
}

export type RiskSeverity = "low" | "medium" | "high" | "critical" | string;
export type RiskLikelihood = "low" | "medium" | "high" | string;
export type RiskStatus = "open" | "mitigated" | "closed" | string;

export interface Risk {
  id: string;
  project_id?: string;
  title: string;
  description?: string;
  severity?: RiskSeverity;
  likelihood?: RiskLikelihood;
  status?: RiskStatus;
  owner_user_id?: string;
  owner_name?: string;
  [key: string]: unknown;
}

export type DecisionStatus = "proposed" | "approved" | "rejected" | string;

export interface Decision {
  id: string;
  project_id?: string;
  title: string;
  description?: string;
  decided_by?: string;
  decided_by_user_id?: string;
  decision_date?: string;
  date?: string;
  status?: DecisionStatus;
  [key: string]: unknown;
}

export interface ProjectParticipant {
  id: string;
  project_id: string;
  organization_id?: string;
  user_id?: string;
  role_on_project?: string;
  user_name?: string;
  organization_name?: string;
  avatar_url?: string;
  [key: string]: unknown;
}

export interface Role {
  id: string;
  name: string;
  description?: string;
  [key: string]: unknown;
}

export interface ApprovalItem {
  id: string;
  title: string;
  requested_by?: string;
  due_date?: string;
  type?: string;
}

export interface DocumentItem {
  id: string;
  name: string;
  title?: string;
  updated_at?: string;
  uploaded_by?: string;
  type?: string;
}

export interface QuickAction {
  id: string;
  label: string;
  icon?: string;
  href?: string;
}

// --- Module entities (Documents, Tasks, Meetings, Communication, Engineering,
// Site Progress, Knowledge Base, Notifications, Reports) ---

export type DocumentStatus = "draft" | "in_review" | "approved" | string;

export interface DocumentRecord {
  id: string;
  project_id: string;
  organization_id?: string;
  folder?: string;
  name: string;
  file_url?: string;
  version?: number | string;
  status?: DocumentStatus;
  uploaded_by_user_id?: string;
  created_at?: string;
  [key: string]: unknown;
}

export type TaskStatus = "open" | "in_progress" | "done" | string;
export type TaskPriority = "low" | "medium" | "high" | "urgent" | string;

export interface Task {
  id: string;
  project_id: string;
  title: string;
  description?: string;
  priority?: TaskPriority;
  status?: TaskStatus;
  owner_user_id?: string;
  owner_name?: string;
  assigned_organization_id?: string;
  due_date?: string;
  progress_percent?: number;
  created_at?: string;
  [key: string]: unknown;
}

export interface TaskUpdateEntry {
  id: string;
  description?: string;
  user_id?: string;
  user_name?: string;
  created_at: string;
}

export interface Meeting {
  id: string;
  project_id: string;
  title: string;
  scheduled_at?: string;
  status?: string;
  created_at?: string;
  [key: string]: unknown;
}

export interface ChannelMember {
  id: string;
  user_id: string;
  user_name?: string;
}

export interface Channel {
  id: string;
  project_id?: string;
  name: string;
  is_direct?: boolean;
  is_group?: boolean;
  user_a_id?: string;
  user_b_id?: string;
  other_user_name?: string;
  members?: ChannelMember[];
  [key: string]: unknown;
}

export interface ChannelMessage {
  id: string;
  channel_id: string;
  user_id?: string;
  user_name?: string;
  body: string;
  created_at?: string;
  [key: string]: unknown;
}

export type DrawingStatus = "draft" | "in_review" | "approved" | string;

export interface DrawingComment {
  id: string;
  body: string;
  user_id?: string;
  user_name?: string;
  created_at?: string;
  [key: string]: unknown;
}

export interface Drawing {
  id: string;
  project_id: string;
  title: string;
  discipline?: string;
  version?: number | string;
  file_url?: string;
  status?: DrawingStatus;
  comments?: DrawingComment[];
  created_at?: string;
  [key: string]: unknown;
}

export interface SiteReport {
  id: string;
  project_id: string;
  report_date?: string;
  description?: string;
  progress_percent?: number;
  weather?: string;
  gps_location?: string;
  photo_urls?: string[];
  submitted_by_user_id?: string;
  created_at?: string;
  [key: string]: unknown;
}

export interface KbArticle {
  id: string;
  category?: string;
  title: string;
  content?: string;
  tags?: string[];
  author_user_id?: string;
  created_at?: string;
  [key: string]: unknown;
}

export interface AppNotification {
  id: string;
  type?: string;
  title: string;
  body?: string;
  is_read?: boolean;
  created_at?: string;
  [key: string]: unknown;
}

export interface UnreadCount {
  unread_count: number;
  [key: string]: unknown;
}

export interface ProjectProgressReport {
  [key: string]: unknown;
}

export interface TasksSummaryReport {
  [key: string]: unknown;
}

export interface RisksSummaryReport {
  [key: string]: unknown;
}

export interface ActivityReport {
  [key: string]: unknown;
}

export interface UpdateMePayload {
  full_name?: string;
  phone?: string;
  title?: string;
  avatar_url?: string;
}

export interface DashboardSummary {
  project_summary?: {
    total?: number;
    active?: number;
    completed?: number;
    on_hold?: number;
    [key: string]: unknown;
  };
  project_health?: {
    on_track?: number;
    at_risk?: number;
    off_track?: number;
    [key: string]: unknown;
  };
  recent_activity?: ActivityItem[];
  upcoming_deadlines?: (Milestone | Deliverable)[];
  pending_approvals?: ApprovalItem[];
  open_tasks_count?: number;
  recent_documents?: DocumentItem[];
  unread_messages_count?: number;
  milestones?: Milestone[];
  quick_actions?: QuickAction[];
}
