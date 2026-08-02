"use client";

import { useEffect, useRef, useState } from "react";

import { apiFetch, apiFetchRaw } from "@/lib/api-client";

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

interface TaskCommentAttachment {
  document_id: string;
  filename: string;
  mime_type: string;
  size_bytes: number;
}

interface TaskCommentResponse {
  id: string;
  task_id: string;
  author_id: string;
  body: string;
  created_at: string;
  attachment?: TaskCommentAttachment | null;
}

interface MeResponse {
  id: string;
  alias: string;
}

function formatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function TaskAttachmentView({ attachment }: { attachment: TaskCommentAttachment }) {
  const [objectUrl, setObjectUrl] = useState<string | null>(null);
  const [error, setError] = useState(false);

  useEffect(() => {
    let cancelled = false;
    let url: string | null = null;
    apiFetch<{ token: string }>(`/api/v1/documents/${attachment.document_id}/download-url`)
      .then(({ token }) => apiFetchRaw(`/api/v1/downloads/${token}`))
      .then(async (res) => {
        if (!res.ok) throw new Error("Failed to load attachment");
        const blob = await res.blob();
        if (cancelled) return;
        url = URL.createObjectURL(blob);
        setObjectUrl(url);
      })
      .catch(() => {
        if (!cancelled) setError(true);
      });
    return () => {
      cancelled = true;
      if (url) URL.revokeObjectURL(url);
    };
  }, [attachment.document_id]);

  if (error) return <p className="mt-1 text-xs text-vault-danger">Failed to load attachment.</p>;
  if (!objectUrl) return <p className="mt-1 text-xs text-slate-500">Loading {attachment.filename}...</p>;

  if (attachment.mime_type.startsWith("image/")) {
    return (
      <a href={objectUrl} target="_blank" rel="noreferrer" className="mt-1 block">
        <img src={objectUrl} alt={attachment.filename} className="max-h-56 rounded border border-vault-border" />
      </a>
    );
  }

  return (
    <a
      href={objectUrl}
      target="_blank"
      rel="noreferrer"
      className="mt-1 flex w-fit items-center gap-2 rounded border border-vault-border bg-vault-surface px-2 py-1 text-xs text-vault-accent hover:underline"
    >
      📄 {attachment.filename} <span className="text-slate-500">({formatSize(attachment.size_bytes)})</span>
    </a>
  );
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

const STATUS_LABEL: Record<TaskResponse["status"], string> = {
  todo: "To Do",
  in_progress: "In Progress",
  review: "In Review",
  done: "Resolved",
};

export default function TaskDetailPanel({
  task,
  members,
  milestones,
  onClose,
  onUpdated,
  onDeleted,
}: {
  task: TaskResponse;
  members: ProjectMemberResponse[];
  milestones: MilestoneResponse[];
  onClose: () => void;
  onUpdated: (task: TaskResponse) => void;
  onDeleted: (taskId: string) => void;
}) {
  const [title, setTitle] = useState(task.title);
  const [description, setDescription] = useState(task.description ?? "");
  const [status, setStatus] = useState(task.status);
  const [priority, setPriority] = useState(task.priority);
  const [category, setCategory] = useState(task.category);
  const [assigneeId, setAssigneeId] = useState(task.assignee_id ?? "");
  const [dueDate, setDueDate] = useState(task.due_date ?? "");
  const [milestoneId, setMilestoneId] = useState(task.milestone_id ?? "");

  const [comments, setComments] = useState<TaskCommentResponse[] | null>(null);
  const [newComment, setNewComment] = useState("");
  const [saving, setSaving] = useState(false);
  const [posting, setPosting] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [me, setMe] = useState<MeResponse | null>(null);
  const [hkComment, setHkComment] = useState(task.hk_comment ?? "");
  const [hkSaving, setHkSaving] = useState(false);

  useEffect(() => {
    apiFetch<MeResponse>("/api/v1/users/me")
      .then(setMe)
      .catch(() => {});
  }, []);

  useEffect(() => {
    setTitle(task.title);
    setDescription(task.description ?? "");
    setStatus(task.status);
    setPriority(task.priority);
    setCategory(task.category);
    setAssigneeId(task.assignee_id ?? "");
    setDueDate(task.due_date ?? "");
    setMilestoneId(task.milestone_id ?? "");
    setHkComment(task.hk_comment ?? "");
    setComments(null);
    apiFetch<TaskCommentResponse[]>(`/api/v1/tasks/${task.id}/comments`)
      .then(setComments)
      .catch(() => setComments([]));
  }, [task]);

  function aliasFor(userId: string): string {
    return members.find((m) => m.user_id === userId)?.alias ?? userId.slice(0, 8);
  }

  async function handleSave() {
    setSaving(true);
    setError(null);
    try {
      const updated = await apiFetch<TaskResponse>(`/api/v1/tasks/${task.id}`, {
        method: "PATCH",
        body: JSON.stringify({
          title,
          description: description || null,
          status,
          priority,
          category: category || null,
          clear_category: !category,
          assignee_id: assigneeId || null,
          clear_assignee: !assigneeId,
          due_date: dueDate || null,
          clear_due_date: !dueDate,
          milestone_id: milestoneId || null,
          clear_milestone: !milestoneId,
        }),
      });
      onUpdated(updated);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to save task");
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete() {
    if (!confirm(`Delete "${task.title}"? This cannot be undone.`)) return;
    try {
      await apiFetch(`/api/v1/tasks/${task.id}`, { method: "DELETE" });
      onDeleted(task.id);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to delete task");
    }
  }

  async function handlePostUpdate() {
    if (!newComment.trim()) return;
    setPosting(true);
    setError(null);
    try {
      const comment = await apiFetch<TaskCommentResponse>(`/api/v1/tasks/${task.id}/comments`, {
        method: "POST",
        body: JSON.stringify({ body: newComment.trim() }),
      });
      setComments((prev) => [...(prev ?? []), comment]);
      setNewComment("");
      onUpdated({ ...task, latest_update: comment.body, latest_update_at: comment.created_at });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to post update");
    } finally {
      setPosting(false);
    }
  }

  async function handleAttachFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    setError(null);
    try {
      const form = new FormData();
      form.append("file", file);
      form.append("body", newComment.trim());
      const comment = await apiFetch<TaskCommentResponse>(`/api/v1/tasks/${task.id}/comments/attachment`, {
        method: "POST",
        body: form,
      });
      setComments((prev) => [...(prev ?? []), comment]);
      setNewComment("");
      onUpdated({ ...task, latest_update: comment.body, latest_update_at: comment.created_at });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to upload attachment");
    } finally {
      setUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  }

  async function handlePostHkComment() {
    if (!hkComment.trim()) return;
    setHkSaving(true);
    setError(null);
    try {
      const updated = await apiFetch<TaskResponse>(`/api/v1/tasks/${task.id}/hk-comment`, {
        method: "PUT",
        body: JSON.stringify({ body: hkComment.trim() }),
      });
      onUpdated(updated);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to post HK comment");
    } finally {
      setHkSaving(false);
    }
  }

  const canPostHkComment = me?.alias.toLowerCase() === "harshil";

  return (
    <div className="fixed inset-0 z-40 flex justify-end bg-black/40" onClick={onClose}>
      <div
        className="flex h-full w-full max-w-md flex-col overflow-y-auto border-l border-vault-border bg-vault-surface shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between border-b border-vault-border bg-vault-hero p-4">
          <input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            className="w-full bg-transparent text-lg font-bold text-white focus:outline-none"
          />
          <div className="flex shrink-0 items-center gap-2">
            <button
              onClick={handleDelete}
              className="rounded bg-vault-danger/80 px-2 py-1 text-xs font-medium text-white hover:bg-vault-danger"
            >
              Delete
            </button>
            <button onClick={onClose} className="text-slate-300 hover:text-white">
              ✕
            </button>
          </div>
        </div>

        <div className="space-y-4 p-4">
          {error && (
            <p className="rounded-lg border border-vault-danger/30 bg-vault-danger/10 px-3 py-2 text-sm text-vault-danger">
              {error}
            </p>
          )}

          <div>
            <p className="mb-1 text-xs uppercase tracking-wide text-slate-500">Description</p>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={3}
              placeholder="No description"
              className="w-full rounded-lg border border-vault-border bg-vault-bg px-3 py-2 text-sm text-slate-100 focus:border-vault-accent focus:outline-none"
            />
          </div>

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div>
              <p className="mb-1 text-xs uppercase tracking-wide text-slate-500">Status</p>
              <select
                value={status}
                onChange={(e) => setStatus(e.target.value as TaskResponse["status"])}
                className="w-full rounded-lg border border-vault-border bg-vault-bg px-2 py-1.5 text-sm text-slate-200"
              >
                {STATUSES.map((s) => (
                  <option key={s} value={s}>
                    {STATUS_LABEL[s]}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <p className="mb-1 text-xs uppercase tracking-wide text-slate-500">Priority</p>
              <select
                value={priority}
                onChange={(e) => setPriority(e.target.value as TaskResponse["priority"])}
                className="w-full rounded-lg border border-vault-border bg-vault-bg px-2 py-1.5 text-sm capitalize text-slate-200"
              >
                {PRIORITIES.map((p) => (
                  <option key={p} value={p}>
                    {p}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <p className="mb-1 text-xs uppercase tracking-wide text-slate-500">Category</p>
              <select
                value={category ?? ""}
                onChange={(e) => setCategory((e.target.value || null) as TaskResponse["category"])}
                className="w-full rounded-lg border border-vault-border bg-vault-bg px-2 py-1.5 text-sm capitalize text-slate-200"
              >
                <option value="">No category</option>
                {CATEGORIES.map((c) => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <p className="mb-1 text-xs uppercase tracking-wide text-slate-500">Due Date</p>
              <input
                type="date"
                value={dueDate}
                onChange={(e) => setDueDate(e.target.value)}
                className="w-full rounded-lg border border-vault-border bg-vault-bg px-2 py-1.5 text-sm text-slate-200"
              />
            </div>
            <div>
              <p className="mb-1 text-xs uppercase tracking-wide text-slate-500">Responsible</p>
              <select
                value={assigneeId}
                onChange={(e) => setAssigneeId(e.target.value)}
                className="w-full rounded-lg border border-vault-border bg-vault-bg px-2 py-1.5 text-sm text-slate-200"
              >
                <option value="">Unassigned</option>
                {members.map((m) => (
                  <option key={m.user_id} value={m.user_id}>
                    {m.alias}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <p className="mb-1 text-xs uppercase tracking-wide text-slate-500">Section</p>
              <select
                value={milestoneId}
                onChange={(e) => setMilestoneId(e.target.value)}
                className="w-full rounded-lg border border-vault-border bg-vault-bg px-2 py-1.5 text-sm text-slate-200"
              >
                <option value="">No section</option>
                {milestones.map((m) => (
                  <option key={m.id} value={m.id}>
                    {m.name}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <button
            onClick={handleSave}
            disabled={saving}
            className="w-full rounded-lg bg-gradient-to-r from-vault-accent to-vault-accent2 px-4 py-2 text-sm font-medium text-white disabled:opacity-50"
          >
            {saving ? "Saving..." : "Save Changes"}
          </button>

          <div className="border-t border-vault-border pt-4">
            <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-500">Updates</p>
            <div className="mb-3 space-y-3">
              {comments === null && <p className="text-sm text-slate-500">Loading...</p>}
              {comments && comments.length === 0 && (
                <p className="text-sm text-slate-500">No updates yet — post the first one below.</p>
              )}
              {comments?.map((c) => (
                <div key={c.id} className="rounded-lg border border-vault-border bg-vault-bg p-3">
                  <p className="mb-1 flex items-center justify-between text-xs text-slate-500">
                    <span className="font-medium text-slate-300">{aliasFor(c.author_id)}</span>
                    <span>{new Date(c.created_at).toLocaleString()}</span>
                  </p>
                  <p className="text-sm text-slate-200">{c.body}</p>
                  {c.attachment && <TaskAttachmentView attachment={c.attachment} />}
                </div>
              ))}
            </div>
            <textarea
              value={newComment}
              onChange={(e) => setNewComment(e.target.value)}
              placeholder="Add a progress note..."
              rows={2}
              className="mb-2 w-full rounded-lg border border-vault-border bg-vault-bg px-3 py-2 text-sm text-slate-100 focus:border-vault-accent focus:outline-none"
            />
            <div className="flex gap-2">
              <input ref={fileInputRef} type="file" className="hidden" onChange={handleAttachFile} />
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                disabled={uploading}
                title="Attach a photo or file to this update"
                className="rounded-lg border border-vault-border px-3 py-2 text-sm text-slate-300 hover:border-vault-accent disabled:opacity-50"
              >
                {uploading ? "..." : "📎"}
              </button>
              <button
                onClick={handlePostUpdate}
                disabled={posting || !newComment.trim()}
                className="flex-1 rounded-lg border border-vault-accent2/50 py-2 text-sm font-medium text-vault-accent2 hover:bg-vault-accent2/10 disabled:opacity-50"
              >
                {posting ? "Posting..." : "Post Update"}
              </button>
            </div>
          </div>

          <div className="border-t border-vault-border pt-4">
            <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-500">HK Comment</p>
            {task.hk_comment_at && (
              <p className="mb-1 text-xs text-slate-500">Last updated {new Date(task.hk_comment_at).toLocaleString()}</p>
            )}
            {canPostHkComment ? (
              <>
                <textarea
                  value={hkComment}
                  onChange={(e) => setHkComment(e.target.value)}
                  placeholder="Harshil's comment..."
                  rows={2}
                  className="mb-2 w-full rounded-lg border border-vault-border bg-vault-bg px-3 py-2 text-sm text-slate-100 focus:border-vault-accent focus:outline-none"
                />
                <button
                  onClick={handlePostHkComment}
                  disabled={hkSaving || !hkComment.trim()}
                  className="w-full rounded-lg border border-vault-warning/50 py-2 text-sm font-medium text-vault-warning hover:bg-vault-warning/10 disabled:opacity-50"
                >
                  {hkSaving ? "Posting..." : "Post HK Comment"}
                </button>
              </>
            ) : (
              <p className="rounded-lg border border-vault-border bg-vault-bg p-3 text-sm text-slate-200">
                {task.hk_comment || "No comment from Harshil yet."}
              </p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
