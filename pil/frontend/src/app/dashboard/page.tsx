"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";

import { ApiError, apiFetch } from "@/lib/api-client";
import { ensureDefaultWorkspace } from "@/lib/workspace";

interface MeResponse {
  id: string;
  alias: string;
}

interface TaskResponse {
  id: string;
  title: string;
  status: "todo" | "in_progress" | "review" | "done";
  due_date: string | null;
  created_at: string;
}

interface DocumentResponse {
  id: string;
  name: string;
  status: "draft" | "pending_approval" | "approved" | "rejected";
  created_at: string;
}

interface MilestoneResponse {
  id: string;
  name: string;
  due_date: string | null;
}

interface NotificationResponse {
  id: string;
}

function greeting(): string {
  const hour = new Date().getHours();
  if (hour < 12) return "Good morning";
  if (hour < 18) return "Good afternoon";
  return "Good evening";
}

function relativeDate(iso: string): string {
  const diffDays = Math.round((new Date(iso).getTime() - Date.now()) / 86400000);
  if (diffDays === 0) return "today";
  if (diffDays > 0) return `in ${diffDays} day${diffDays === 1 ? "" : "s"}`;
  return `${-diffDays} day${diffDays === -1 ? "" : "s"} ago`;
}

function WidgetCard({ icon, title, children }: { icon: string; title: string; children: React.ReactNode }) {
  return (
    <div className="rounded-xl border border-vault-border bg-vault-surface p-4">
      <p className="mb-3 flex items-center gap-2 text-sm font-semibold text-slate-200">
        <span>{icon}</span>
        {title}
      </p>
      {children}
    </div>
  );
}

export default function DashboardPage() {
  const router = useRouter();
  const [me, setMe] = useState<MeResponse | null>(null);
  const [tasks, setTasks] = useState<TaskResponse[] | null>(null);
  const [documents, setDocuments] = useState<DocumentResponse[] | null>(null);
  const [milestones, setMilestones] = useState<MilestoneResponse[] | null>(null);
  const [unreadCount, setUnreadCount] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    apiFetch<MeResponse>("/api/v1/users/me")
      .then(setMe)
      .catch((err) => {
        if (err instanceof ApiError && err.status === 401) router.replace("/login");
      });

    ensureDefaultWorkspace()
      .then(async (ws) => {
        const [taskList, docs, milestoneList, notifications] = await Promise.all([
          apiFetch<TaskResponse[]>(`/api/v1/projects/${ws.projectId}/tasks`),
          apiFetch<DocumentResponse[]>(`/api/v1/projects/${ws.projectId}/documents`),
          apiFetch<MilestoneResponse[]>(`/api/v1/projects/${ws.projectId}/milestones`),
          apiFetch<NotificationResponse[]>("/api/v1/notifications?unread=true").catch(() => []),
        ]);
        setTasks(taskList);
        setDocuments(docs);
        setMilestones(milestoneList);
        setUnreadCount(notifications.length);
      })
      .catch((err) => {
        if (err instanceof ApiError && err.status === 401) {
          router.replace("/login");
          return;
        }
        setError(err instanceof Error ? err.message : "Failed to set up workspace");
      });
  }, [router]);

  const upcomingDeadlines = (tasks ?? [])
    .filter((t) => t.status !== "done" && t.due_date)
    .sort((a, b) => (a.due_date as string).localeCompare(b.due_date as string))
    .slice(0, 5);

  const pendingApprovals = (documents ?? []).filter((d) => d.status === "pending_approval").slice(0, 5);
  const openTasksCount = (tasks ?? []).filter((t) => t.status !== "done").length;
  const recentDocuments = (documents ?? [])
    .slice()
    .sort((a, b) => b.created_at.localeCompare(a.created_at))
    .slice(0, 5);

  return (
    <div className="px-6 py-8">
      <div className="mx-auto max-w-6xl">
        <h1 className="text-2xl font-bold text-slate-100">Dashboard</h1>
        <p className="mt-1 text-sm text-slate-400">
          {greeting()}
          {me ? `, ${me.alias}` : ""} — a shared overview of everything happening across your workspace.
        </p>

        {error && (
          <p className="mt-4 rounded-lg border border-vault-danger/30 bg-vault-danger/10 px-3 py-2 text-sm text-vault-danger">
            {error}
          </p>
        )}

        <div className="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          <WidgetCard icon="📅" title="Upcoming Deadlines">
            {tasks === null && <p className="text-sm text-slate-500">Loading...</p>}
            {tasks && upcomingDeadlines.length === 0 && <p className="text-sm text-slate-500">Nothing due.</p>}
            <ul className="space-y-2">
              {upcomingDeadlines.map((t) => (
                <li key={t.id} className="flex items-center justify-between text-sm">
                  <span className="text-slate-200">{t.title}</span>
                  <span className="text-xs text-slate-500">{relativeDate(t.due_date as string)}</span>
                </li>
              ))}
            </ul>
          </WidgetCard>

          <WidgetCard icon="📋" title="Pending Approvals">
            {documents === null && <p className="text-sm text-slate-500">Loading...</p>}
            {documents && pendingApprovals.length === 0 && <p className="text-sm text-slate-500">Nothing pending.</p>}
            <ul className="space-y-2">
              {pendingApprovals.map((d) => (
                <li key={d.id} className="flex items-center justify-between text-sm">
                  <span className="truncate text-slate-200">{d.name}</span>
                  <span className="rounded-full bg-vault-warning/20 px-2 py-0.5 text-xs text-vault-warning">Pending</span>
                </li>
              ))}
            </ul>
          </WidgetCard>

          <WidgetCard icon="✓" title="Open Tasks">
            <p className="text-3xl font-bold text-slate-100">{tasks === null ? "—" : openTasksCount}</p>
            <p className="mb-2 text-sm text-slate-500">Tasks awaiting action</p>
            <Link href="/dashboard/tasks" className="text-sm text-vault-accent hover:underline">
              View all tasks →
            </Link>
          </WidgetCard>

          <WidgetCard icon="📄" title="Recent Documents">
            {documents === null && <p className="text-sm text-slate-500">Loading...</p>}
            {documents && recentDocuments.length === 0 ? (
              <div className="rounded-lg border border-dashed border-vault-border py-6 text-center">
                <p className="text-sm text-slate-300">Nothing here yet</p>
                <p className="text-xs text-slate-500">Shared documents will appear here.</p>
              </div>
            ) : (
              <ul className="space-y-2">
                {recentDocuments.map((d) => (
                  <li key={d.id} className="truncate text-sm text-slate-200">
                    {d.name}
                  </li>
                ))}
              </ul>
            )}
          </WidgetCard>

          <WidgetCard icon="💬" title="Unread Messages">
            <p className="text-3xl font-bold text-slate-100">{unreadCount ?? "—"}</p>
            <p className="mb-2 text-sm text-slate-500">Waiting in your inbox</p>
            <Link href="/dashboard/chat" className="text-sm text-vault-accent hover:underline">
              Open Communication →
            </Link>
          </WidgetCard>

          <WidgetCard icon="📌" title="Project Milestones">
            {milestones === null && <p className="text-sm text-slate-500">Loading...</p>}
            {milestones && milestones.length === 0 && <p className="text-sm text-slate-500">No sections yet.</p>}
            <ul className="space-y-2">
              {milestones?.map((m) => (
                <li key={m.id} className="text-sm text-slate-200">
                  {m.name}
                </li>
              ))}
            </ul>
          </WidgetCard>

          <WidgetCard icon="⚡" title="Quick Actions">
            <div className="flex flex-wrap gap-2">
              <Link
                href="/dashboard/tasks"
                className="rounded-lg border border-vault-border px-3 py-1.5 text-sm text-slate-300 hover:border-vault-accent"
              >
                New Task
              </Link>
              <Link
                href="/dashboard/documents"
                className="rounded-lg border border-vault-border px-3 py-1.5 text-sm text-slate-300 hover:border-vault-accent"
              >
                Upload Document
              </Link>
              <Link
                href="/dashboard/chat"
                className="rounded-lg border border-vault-border px-3 py-1.5 text-sm text-slate-300 hover:border-vault-accent"
              >
                Message Someone
              </Link>
            </div>
          </WidgetCard>
        </div>
      </div>
    </div>
  );
}
