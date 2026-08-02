"use client";

import { useEffect, useMemo, useRef, useState } from "react";

import { apiFetch, apiFetchRaw } from "@/lib/api-client";

interface DocumentResponse {
  id: string;
  project_id: string;
  folder_path: string;
  name: string;
  status: string;
  checked_out_by: string | null;
  created_at: string;
}

interface DownloadUrlResponse {
  token: string;
  expires_in: number;
}

interface MeResponse {
  id: string;
  system_role: string;
}

const UNCATEGORIZED = "/";

export default function DocumentsPanel({ projectId }: { projectId: string }) {
  const [documents, setDocuments] = useState<DocumentResponse[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [downloadingId, setDownloadingId] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [me, setMe] = useState<MeResponse | null>(null);

  const [showModal, setShowModal] = useState(false);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [category, setCategory] = useState(UNCATEGORIZED);
  const [newCategory, setNewCategory] = useState("");
  const [categoryFilter, setCategoryFilter] = useState<string>("all");
  const fileInputRef = useRef<HTMLInputElement>(null);

  function loadDocuments() {
    apiFetch<DocumentResponse[]>(`/api/v1/projects/${projectId}/documents`)
      .then(setDocuments)
      .catch((err) => setError(err instanceof Error ? err.message : "Failed to load documents"));
  }

  useEffect(() => {
    loadDocuments();
    apiFetch<MeResponse>("/api/v1/users/me")
      .then(setMe)
      .catch(() => {});
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [projectId]);

  const categories = useMemo(() => {
    const set = new Set((documents ?? []).map((d) => d.folder_path).filter((p) => p !== UNCATEGORIZED));
    return Array.from(set).sort();
  }, [documents]);

  function categoryLabel(path: string): string {
    return path === UNCATEGORIZED ? "Uncategorized" : path.replace(/^\//, "");
  }

  async function handleUpload() {
    if (!selectedFile) return;
    const folderPath = newCategory.trim() ? `/${newCategory.trim()}` : category;
    setUploading(true);
    setError(null);
    try {
      const form = new FormData();
      form.append("file", selectedFile);
      form.append("name", selectedFile.name);
      form.append("folder_path", folderPath);
      const response = await apiFetchRaw(`/api/v1/projects/${projectId}/documents`, {
        method: "POST",
        body: form,
      });
      if (!response.ok) {
        const problem = await response.json().catch(() => null);
        throw new Error(problem?.title ?? "Upload failed");
      }
      const doc = (await response.json()) as DocumentResponse;
      setDocuments((prev) => [...(prev ?? []), doc]);
      setSelectedFile(null);
      setNewCategory("");
      setCategory(UNCATEGORIZED);
      setShowModal(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to upload document");
    } finally {
      setUploading(false);
    }
  }

  async function handleDownload(doc: DocumentResponse) {
    setDownloadingId(doc.id);
    setError(null);
    try {
      const { token } = await apiFetch<DownloadUrlResponse>(`/api/v1/documents/${doc.id}/download-url`);
      const response = await apiFetchRaw(`/api/v1/downloads/${token}`);
      if (!response.ok) throw new Error("Download failed");
      const blob = await response.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = doc.name;
      a.click();
      URL.revokeObjectURL(url);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to download document");
    } finally {
      setDownloadingId(null);
    }
  }

  async function handleDeleteDocument(doc: DocumentResponse) {
    if (!confirm(`Delete "${doc.name}"? This cannot be undone.`)) return;
    setDeletingId(doc.id);
    setError(null);
    try {
      await apiFetch(`/api/v1/documents/${doc.id}`, { method: "DELETE" });
      setDocuments((prev) => (prev ?? []).filter((d) => d.id !== doc.id));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to delete document");
    } finally {
      setDeletingId(null);
    }
  }

  const STATUS_BADGE: Record<string, string> = {
    draft: "bg-slate-700/60 text-slate-300",
    pending_approval: "bg-vault-warning/20 text-vault-warning",
    approved: "bg-vault-success/20 text-vault-success",
    rejected: "bg-vault-danger/20 text-vault-danger",
  };

  const filteredDocuments = (documents ?? []).filter(
    (d) => categoryFilter === "all" || d.folder_path === categoryFilter,
  );

  return (
    <div>
      <div className="mb-4 flex items-center justify-between">
        <p className="text-sm text-slate-400">Centralized document repository shared across the workspace.</p>
        <button
          onClick={() => setShowModal(true)}
          className="rounded-lg bg-gradient-to-r from-vault-accent to-vault-accent2 px-4 py-2 text-sm font-medium text-white"
        >
          + New Document
        </button>
      </div>

      {error && (
        <p className="mb-3 rounded-lg border border-vault-danger/30 bg-vault-danger/10 px-3 py-2 text-sm text-vault-danger">
          {error}
        </p>
      )}

      {documents && documents.length > 0 && (
        <div className="mb-4 flex items-center gap-2">
          <select
            value={categoryFilter}
            onChange={(e) => setCategoryFilter(e.target.value)}
            className="rounded-lg border border-vault-border bg-vault-surface px-2 py-1.5 text-sm text-slate-200"
          >
            <option value="all">All Categories</option>
            {[UNCATEGORIZED, ...categories].map((c) => (
              <option key={c} value={c}>
                {categoryLabel(c)}
              </option>
            ))}
          </select>
        </div>
      )}

      {documents === null ? (
        <p className="text-sm text-slate-400">Loading...</p>
      ) : documents.length === 0 ? (
        <div className="rounded-xl border border-dashed border-vault-border bg-vault-surface py-16 text-center">
          <p className="mb-1 text-2xl">📄</p>
          <p className="text-sm font-medium text-slate-200">No documents yet</p>
          <p className="text-sm text-slate-500">Upload a document to get started.</p>
        </div>
      ) : (
        <div className="space-y-2">
          {filteredDocuments.map((doc) => (
            <div
              key={doc.id}
              className="flex items-center justify-between rounded-lg border border-vault-border bg-vault-surface p-3"
            >
              <div>
                <p className="text-sm font-medium text-slate-100">{doc.name}</p>
                <p className="mt-0.5 text-xs text-slate-500">{categoryLabel(doc.folder_path)}</p>
              </div>
              <div className="flex items-center gap-3">
                <span
                  className={`rounded-full px-2 py-0.5 text-xs capitalize ${STATUS_BADGE[doc.status] ?? "bg-slate-700/60 text-slate-300"}`}
                >
                  {doc.status.replace("_", " ")}
                </span>
                <button
                  onClick={() => handleDownload(doc)}
                  disabled={downloadingId === doc.id}
                  className="rounded border border-vault-border px-3 py-1 text-xs text-slate-300 hover:border-vault-accent disabled:opacity-50"
                >
                  {downloadingId === doc.id ? "..." : "Download"}
                </button>
                {me?.system_role === "system_admin" && (
                  <button
                    onClick={() => handleDeleteDocument(doc)}
                    disabled={deletingId === doc.id}
                    className="rounded border border-vault-danger/40 px-3 py-1 text-xs text-vault-danger hover:bg-vault-danger/10 disabled:opacity-50"
                  >
                    {deletingId === doc.id ? "..." : "Delete"}
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {showModal && (
        <div
          className="fixed inset-0 z-40 flex items-center justify-center bg-black/50 p-4"
          onClick={() => setShowModal(false)}
        >
          <div
            className="w-full max-w-md rounded-xl border border-vault-border bg-vault-surface p-5 shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="mb-4 flex items-center justify-between">
              <h2 className="text-lg font-bold text-slate-100">Upload Document</h2>
              <button onClick={() => setShowModal(false)} className="text-slate-400 hover:text-white">
                ✕
              </button>
            </div>

            <label className="mb-4 flex cursor-pointer flex-col items-center justify-center rounded-xl border border-dashed border-vault-border bg-vault-bg py-8 text-center hover:border-vault-accent">
              <span className="mb-2 text-2xl">📁</span>
              <span className="text-sm font-medium text-slate-200">
                {selectedFile ? selectedFile.name : "Drag & drop or click to browse"}
              </span>
              <span className="text-xs text-slate-500">Max 100 MB</span>
              <input
                ref={fileInputRef}
                type="file"
                className="hidden"
                onChange={(e) => setSelectedFile(e.target.files?.[0] ?? null)}
              />
            </label>

            <p className="mb-1 text-xs uppercase tracking-wide text-slate-500">Category</p>
            <select
              value={category}
              onChange={(e) => {
                setCategory(e.target.value);
                setNewCategory("");
              }}
              className="mb-3 w-full rounded-lg border border-vault-border bg-vault-bg px-3 py-2 text-sm text-slate-200"
            >
              <option value={UNCATEGORIZED}>Uncategorized</option>
              {categories.map((c) => (
                <option key={c} value={c}>
                  {categoryLabel(c)}
                </option>
              ))}
            </select>

            <p className="mb-1 text-xs uppercase tracking-wide text-slate-500">Or create a new category</p>
            <input
              value={newCategory}
              onChange={(e) => setNewCategory(e.target.value)}
              placeholder="e.g. Finance, Legal, HR..."
              className="mb-4 w-full rounded-lg border border-vault-border bg-vault-bg px-3 py-2 text-sm text-slate-100"
            />

            <button
              onClick={handleUpload}
              disabled={uploading || !selectedFile}
              className="w-full rounded-lg bg-gradient-to-r from-vault-accent to-vault-accent2 px-4 py-2 text-sm font-medium text-white disabled:opacity-50"
            >
              {uploading ? "Uploading..." : "Upload"}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
