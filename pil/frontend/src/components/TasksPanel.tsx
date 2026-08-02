"use client";

import { useEffect, useMemo, useState } from "react";

import { apiFetch } from "@/lib/api-client";
import TaskDetailPanel from "@/components/TaskDetailPanel";

interface TaskResponse {
  id: string;
  project_id: string;
  title: string;
  description: string | null;
  status: "todo" | "in_progress" | "review" | "done";
  priority: "low" | "medium" | "high" | "critical";
  category: "legal" | "finance" | "projects" | "other" | null;
  latest_update: string | null;
  latest_update_at: string | null;
  hk_comment: string | null;
  hk_comment_at: string | null;
  assignee_id: string | null;
  due_date: string | null;
  milestone_id: string | null;
  created_by: string;
  created_at: string;
}

interface MeResponse {
  id: string;
  alias: string;
}

interface ProjectMemberResponse {
  user_id: string;
  alias: string;
  role: string;
  added_at: string;
}

interface MilestoneResponse {
  id: string;
  project_id: string;
  name: string;
  due_date: string | null;
  created_at: string;
}

const STATUSES: TaskResponse["status"][] = ["todo", "in_progress", "review", "done"];
const PRIORITIES: TaskResponse["priority"][] = ["low", "medium", "high", "critical"];
const CATEGORIES: NonNullable<TaskResponse["category"]>[] = ["legal", "finance", "projects", "other"];

const CATEGORY_BADGE: Record<NonNullable<TaskResponse["category"]>, string> = {
  legal: "bg-purple-500/20 text-purple-300",
  finance: "bg-emerald-500/20 text-emerald-300",
  projects: "bg-vault-accent/25 text-vault-accent",
  other: "bg-slate-700/60 text-slate-300",
};

const STATUS_LABEL: Record<TaskResponse["status"], string> = {
  todo: "To Do",
  in_progress: "In Progress",
  review: "In Review",
  done: "Resolved",
};

const STATUS_BADGE: Record<TaskResponse["status"], string> = {
  todo: "bg-slate-700/60 text-slate-200",
  in_progress: "bg-vault-accent/25 text-vault-accent",
  review: "bg-vault-warning/20 text-vault-warning",
  done: "bg-vault-success/20 text-vault-success",
};

const PRIORITY_BADGE: Record<TaskResponse["priority"], string> = {
  low: "bg-slate-700/60 text-slate-300",
  medium: "bg-vault-accent/25 text-vault-accent",
  high: "bg-vault-warning/20 text-vault-warning",
  critical: "bg-vault-danger/20 text-vault-danger",
};

function todayIso(): string {
  return new Date().toISOString().slice(0, 10);
}

export default function TasksPanel({ projectId }: { projectId: string }) {
  const [me, setMe] = useState<MeResponse | null>(null);
  const [tasks, setTasks] = useState<TaskResponse[] | null>(null);
  const [members, setMembers] = useState<ProjectMemberResponse[]>([]);
  const [milestones, setMilestones] = useState<MilestoneResponse[]>([]);
  const [error, setError] = useState<string | null>(null);

  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<TaskResponse["status"] | "all">("all");
  const [priorityFilter, setPriorityFilter] = useState<TaskResponse["priority"] | "all">("all");
  const [categoryFilter, setCategoryFilter] = useState<TaskResponse["category"] | "all">("all");

  const [showForm, setShowForm] = useState(false);
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [priority, setPriority] = useState<TaskResponse["priority"]>("medium");
  const [category, setCategory] = useState<TaskResponse["category"]>(null);
  const [dueDate, setDueDate] = useState("");
  const [assigneeId, setAssigneeId] = useState("");
  const [milestoneId, setMilestoneId] = useState("");
  const [newMilestoneName, setNewMilestoneName] = useState("");
  const [creating, setCreating] = useState(false);
  const [selectedTask, setSelectedTask] = useState<TaskResponse | null>(null);

  function aliasFor(userId: string | null): string {
    if (!userId) return "—";
    if (me && userId === me.id) return "You";
    return members.find((m) => m.user_id === userId)?.alias ?? userId.slice(0, 8);
  }

  function milestoneName(milestoneIdVal: string | null): string {
    if (!milestoneIdVal) return "—";
    return milestones.find((m) => m.id === milestoneIdVal)?.name ?? "—";
  }

  useEffect(() => {
    apiFetch<MeResponse>("/api/v1/users/me").then(setMe).catch(() => {});
    apiFetch<TaskResponse[]>(`/api/v1/projects/${projectId}/tasks`)
      .then(setTasks)
      .catch((err) => setError(err instanceof Error ? err.message : "Failed to load tasks"));
    apiFetch<ProjectMemberResponse[]>(`/api/v1/projects/${projectId}/members`)
      .then(setMembers)
      .catch(() => {});
    apiFetch<MilestoneResponse[]>(`/api/v1/projects/${projectId}/milestones`)
      .then(setMilestones)
      .catch(() => {});
  }, [projectId]);

  const stats = useMemo(() => {
    const list = tasks ?? [];
    return {
      total: list.length,
      todo: list.filter((t) => t.status === "todo").length,
      inProgress: list.filter((t) => t.status === "in_progress").length,
      review: list.filter((t) => t.status === "review").length,
      done: list.filter((t) => t.status === "done").length,
      overdue: list.filter((t) => t.status !== "done" && t.due_date && t.due_date < todayIso()).length,
    };
  }, [tasks]);

  const filtered = useMemo(() => {
    return (tasks ?? []).filter((t) => {
      if (statusFilter !== "all" && t.status !== statusFilter) return false;
      if (priorityFilter !== "all" && t.priority !== priorityFilter) return false;
      if (categoryFilter !== "all" && t.category !== categoryFilter) return false;
      if (search.trim() && !t.title.toLowerCase().includes(search.trim().toLowerCase())) return false;
      return true;
    });
  }, [tasks, search, statusFilter, priorityFilter, categoryFilter]);

  async function handleCreateMilestone() {
    if (!newMilestoneName.trim()) return;
    try {
      const milestone = await apiFetch<MilestoneResponse>(`/api/v1/projects/${projectId}/milestones`, {
        method: "POST",
        body: JSON.stringify({ name: newMilestoneName.trim() }),
      });
      setMilestones((prev) => [...prev, milestone]);
      setMilestoneId(milestone.id);
      setNewMilestoneName("");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to create milestone");
    }
  }

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    if (!title.trim()) return;
    setCreating(true);
    setError(null);
    try {
      const task = await apiFetch<TaskResponse>(`/api/v1/projects/${projectId}/tasks`, {
        method: "POST",
        body: JSON.stringify({
          title: title.trim(),
          description: description.trim() || null,
          priority,
          category: category || null,
          due_date: dueDate || null,
          assignee_id: assigneeId || null,
          milestone_id: milestoneId || null,
        }),
      });
      setTasks((prev) => [...(prev ?? []), task]);
      setTitle("");
      setDescription("");
      setPriority("medium");
      setCategory(null);
      setDueDate("");
      setAssigneeId("");
      setMilestoneId("");
      setShowForm(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to create task");
    } finally {
      setCreating(false);
    }
  }

  async function handleStatusChange(task: TaskResponse, status: TaskResponse["status"]) {
    setError(null);
    try {
      const updated = await apiFetch<TaskResponse>(`/api/v1/tasks/${task.id}`, {
        method: "PATCH",
        body: JSON.stringify({ status }),
      });
      setTasks((prev) => (prev ?? []).map((t) => (t.id === updated.id ? updated : t)));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to update task");
    }
  }

  return (
    <div>
      <div className="mb-4 flex items-center justify-between">
        <h2 className="text-base font-semibold text-slate-100">Task Board</h2>
        <button
          onClick={() => setShowForm((v) => !v)}
          className="rounded-lg bg-gradient-to-r from-vault-accent to-vault-accent2 px-4 py-2 text-sm font-medium text-white shadow-lg shadow-vault-accent/20 transition hover:opacity-90"
        >
          + New Task
        </button>
      </div>

      {error && <p className="mb-3 rounded-lg border border-vault-danger/30 bg-vault-danger/10 px-3 py-2 text-sm text-vault-danger">{error}</p>}

      {showForm && (
        <form
          onSubmit={handleCreate}
          className="mb-4 space-y-3 rounded-xl border border-vault-border bg-vault-surface2 p-4 shadow-lg"
        >
          <input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="Task title"
            className="w-full rounded-lg border border-vault-border bg-vault-bg px-3 py-2 text-sm text-slate-100 focus:border-vault-accent focus:outline-none"
          />
          <textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="Description / latest update..."
            rows={2}
            className="w-full rounded-lg border border-vault-border bg-vault-bg px-3 py-2 text-sm text-slate-100 focus:border-vault-accent focus:outline-none"
          />
          <div className="flex flex-wrap items-center gap-2">
            <select
              value={priority}
              onChange={(e) => setPriority(e.target.value as TaskResponse["priority"])}
              className="rounded-lg border border-vault-border bg-vault-bg px-2 py-2 text-sm text-slate-200"
            >
              {PRIORITIES.map((p) => (
                <option key={p} value={p} className="bg-vault-surface">
                  {p}
                </option>
              ))}
            </select>
            <select
              value={category ?? ""}
              onChange={(e) => setCategory((e.target.value || null) as TaskResponse["category"])}
              className="rounded-lg border border-vault-border bg-vault-bg px-2 py-2 text-sm capitalize text-slate-200"
            >
              <option value="">No category</option>
              {CATEGORIES.map((c) => (
                <option key={c} value={c} className="bg-vault-surface capitalize">
                  {c}
                </option>
              ))}
            </select>
            <input
              type="date"
              value={dueDate}
              onChange={(e) => setDueDate(e.target.value)}
              className="rounded-lg border border-vault-border bg-vault-bg px-2 py-2 text-sm text-slate-200"
            />
            <select
              value={assigneeId}
              onChange={(e) => setAssigneeId(e.target.value)}
              className="rounded-lg border border-vault-border bg-vault-bg px-2 py-2 text-sm text-slate-200"
            >
              <option value="">Unassigned</option>
              {members.map((m) => (
                <option key={m.user_id} value={m.user_id} className="bg-vault-surface">
                  {m.alias}
                </option>
              ))}
            </select>
            <select
              value={milestoneId}
              onChange={(e) => setMilestoneId(e.target.value)}
              className="rounded-lg border border-vault-border bg-vault-bg px-2 py-2 text-sm text-slate-200"
            >
              <option value="">No section</option>
              {milestones.map((m) => (
                <option key={m.id} value={m.id} className="bg-vault-surface">
                  {m.name}
                </option>
              ))}
            </select>
            <button
              type="submit"
              disabled={creating || !title.trim()}
              className="ml-auto rounded-lg bg-gradient-to-r from-vault-accent to-vault-accent2 px-4 py-2 text-sm font-medium text-white disabled:opacity-50"
            >
              Add Task
            </button>
          </div>
          <div className="flex items-center gap-2 border-t border-vault-border pt-3">
            <input
              value={newMilestoneName}
              onChange={(e) => setNewMilestoneName(e.target.value)}
              placeholder="New section/milestone name"
              className="flex-1 rounded-lg border border-vault-border bg-vault-bg px-3 py-1.5 text-sm text-slate-100"
            />
            <button
              type="button"
              onClick={handleCreateMilestone}
              disabled={!newMilestoneName.trim()}
              className="rounded-lg border border-vault-accent2/50 px-3 py-1.5 text-sm text-vault-accent2 hover:bg-vault-accent2/10 disabled:opacity-50"
            >
              + Section
            </button>
          </div>
        </form>
      )}

      <div className="mb-4 grid grid-cols-3 gap-3 sm:grid-cols-6">
        {[
          { label: "Total", value: stats.total, color: "text-slate-100", bar: "bg-slate-500" },
          { label: "To Do", value: stats.todo, color: "text-slate-300", bar: "bg-slate-500" },
          { label: "In Progress", value: stats.inProgress, color: "text-vault-accent", bar: "bg-vault-accent" },
          { label: "In Review", value: stats.review, color: "text-vault-warning", bar: "bg-vault-warning" },
          { label: "Resolved", value: stats.done, color: "text-vault-success", bar: "bg-vault-success" },
          {
            label: "Overdue",
            value: stats.overdue,
            color: stats.overdue > 0 ? "text-vault-danger" : "text-slate-500",
            bar: stats.overdue > 0 ? "bg-vault-danger" : "bg-slate-700",
          },
        ].map((tile) => (
          <div
            key={tile.label}
            className="overflow-hidden rounded-xl border border-vault-border bg-vault-surface shadow-sm"
          >
            <div className={`h-1 ${tile.bar}`} />
            <div className="p-3">
              <p className="text-xs text-slate-500">{tile.label}</p>
              <p className={`text-xl font-bold ${tile.color}`}>{tile.value}</p>
            </div>
          </div>
        ))}
      </div>

      <div className="mb-4 flex flex-wrap items-center gap-2">
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search tasks..."
          className="flex-1 rounded-lg border border-vault-border bg-vault-surface px-3 py-1.5 text-sm text-slate-100 focus:border-vault-accent focus:outline-none"
        />
        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value as TaskResponse["status"] | "all")}
          className="rounded-lg border border-vault-border bg-vault-surface px-2 py-1.5 text-sm text-slate-200"
        >
          <option value="all">All Statuses</option>
          {STATUSES.map((s) => (
            <option key={s} value={s}>
              {STATUS_LABEL[s]}
            </option>
          ))}
        </select>
        <select
          value={priorityFilter}
          onChange={(e) => setPriorityFilter(e.target.value as TaskResponse["priority"] | "all")}
          className="rounded-lg border border-vault-border bg-vault-surface px-2 py-1.5 text-sm text-slate-200"
        >
          <option value="all">All Priorities</option>
          {PRIORITIES.map((p) => (
            <option key={p} value={p} className="capitalize">
              {p}
            </option>
          ))}
        </select>
        <select
          value={categoryFilter ?? "all"}
          onChange={(e) => setCategoryFilter((e.target.value === "all" ? "all" : e.target.value) as TaskResponse["category"] | "all")}
          className="rounded-lg border border-vault-border bg-vault-surface px-2 py-1.5 text-sm capitalize text-slate-200"
        >
          <option value="all">All Categories</option>
          {CATEGORIES.map((c) => (
            <option key={c} value={c} className="capitalize">
              {c}
            </option>
          ))}
        </select>
        <button
          onClick={() => {
            setSearch("");
            setStatusFilter("all");
            setPriorityFilter("all");
            setCategoryFilter("all");
          }}
          className="rounded-lg border border-vault-border px-3 py-1.5 text-sm text-slate-300 hover:border-vault-accent"
        >
          Reset
        </button>
        <span className="ml-auto text-xs text-slate-500">{filtered.length} tasks</span>
      </div>

      <div className="overflow-x-auto rounded-xl border border-vault-border bg-vault-surface shadow-sm">
        <table className="w-full text-left text-sm">
          <thead>
            <tr className="border-b border-vault-border bg-vault-surface2 text-xs uppercase tracking-wide text-slate-500">
              <th className="px-3 py-2 font-medium">#</th>
              <th className="px-3 py-2 font-medium">Title</th>
              <th className="px-3 py-2 font-medium">Section</th>
              <th className="px-3 py-2 font-medium">Category</th>
              <th className="px-3 py-2 font-medium">Latest Update</th>
              <th className="px-3 py-2 font-medium">Priority</th>
              <th className="px-3 py-2 font-medium">Due</th>
              <th className="px-3 py-2 font-medium">Responsible</th>
              <th className="px-3 py-2 font-medium">Status</th>
            </tr>
          </thead>
          <tbody>
            {tasks === null && (
              <tr>
                <td colSpan={9} className="px-3 py-6 text-center text-sm text-slate-400">
                  Loading...
                </td>
              </tr>
            )}
            {tasks !== null && filtered.length === 0 && (
              <tr>
                <td colSpan={9} className="px-3 py-6 text-center text-sm text-slate-500">
                  No tasks match.
                </td>
              </tr>
            )}
            {filtered.map((task, i) => (
              <tr
                key={task.id}
                onClick={() => setSelectedTask(task)}
                className="cursor-pointer border-b border-vault-border last:border-0 hover:bg-vault-accent/5"
              >
                <td className="px-3 py-2 text-slate-500">{i + 1}</td>
                <td className="px-3 py-2 font-medium text-slate-100 hover:text-vault-accent hover:underline">
                  {task.title}
                </td>
                <td className="px-3 py-2 text-slate-400">{milestoneName(task.milestone_id)}</td>
                <td className="px-3 py-2">
                  {task.category ? (
                    <span className={`rounded-full px-2 py-0.5 text-xs capitalize ${CATEGORY_BADGE[task.category]}`}>
                      {task.category}
                    </span>
                  ) : (
                    <span className="text-slate-500">—</span>
                  )}
                </td>
                <td className="max-w-xs truncate px-3 py-2 text-slate-400" title={task.latest_update ?? ""}>
                  {task.latest_update || "—"}
                </td>
                <td className="px-3 py-2">
                  <span className={`rounded-full px-2 py-0.5 text-xs capitalize ${PRIORITY_BADGE[task.priority]}`}>
                    {task.priority}
                  </span>
                </td>
                <td className="px-3 py-2 text-slate-400">
                  {task.due_date ?? "—"}
                  {task.due_date && task.status !== "done" && task.due_date < todayIso() && (
                    <span className="ml-1 text-vault-danger">(overdue)</span>
                  )}
                </td>
                <td className="px-3 py-2">
                  <span className="inline-flex items-center gap-1.5 text-slate-300">
                    <span className="flex h-5 w-5 items-center justify-center rounded-full bg-vault-accent2/20 text-[10px] font-semibold text-vault-accent2">
                      {aliasFor(task.assignee_id).slice(0, 1).toUpperCase()}
                    </span>
                    {aliasFor(task.assignee_id)}
                  </span>
                </td>
                <td className="px-3 py-2" onClick={(e) => e.stopPropagation()}>
                  <select
                    value={task.status}
                    onChange={(e) => handleStatusChange(task, e.target.value as TaskResponse["status"])}
                    className={`rounded-full px-2 py-1 text-xs font-medium ${STATUS_BADGE[task.status]}`}
                  >
                    {STATUSES.map((s) => (
                      <option key={s} value={s} className="bg-vault-surface text-slate-200">
                        {STATUS_LABEL[s]}
                      </option>
                    ))}
                  </select>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {selectedTask && (
        <TaskDetailPanel
          task={selectedTask}
          members={members}
          milestones={milestones}
          onClose={() => setSelectedTask(null)}
          onUpdated={(updated) => {
            setTasks((prev) => (prev ?? []).map((t) => (t.id === updated.id ? updated : t)));
            setSelectedTask(updated);
          }}
          onDeleted={(taskId) => {
            setTasks((prev) => (prev ?? []).filter((t) => t.id !== taskId));
            setSelectedTask(null);
          }}
        />
      )}
    </div>
  );
}
