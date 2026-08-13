"use client";
import { useState, useRef, useCallback } from "react";
import { useRouter, useSearchParams } from "next/navigation";

type Folder    = { id: string; name: string; color: string; file_count: string };
type ShelfFile = { id: string; name: string; original_name: string; mime_type: string; file_size: number; description: string | null; uploaded_by: string; created_at: string };
type Crumb     = { id: string; name: string; parent_id: string | null };
type FolderOpt = { id: string; name: string };
type User      = { email: string; name: string; role: string };

const HUB = process.env.NEXT_PUBLIC_PABARI_URL ?? "https://pabari-workspace.up.railway.app";

function fmtBytes(b: number) {
  if (b < 1024) return `${b} B`;
  if (b < 1024 * 1024) return `${(b / 1024).toFixed(1)} KB`;
  return `${(b / (1024 * 1024)).toFixed(1)} MB`;
}

function mimeEmoji(mime: string) {
  if (mime.startsWith("image/")) return "🖼️";
  if (mime === "application/pdf") return "📄";
  if (mime.includes("word") || mime.includes("document")) return "📝";
  if (mime.includes("excel") || mime.includes("sheet")) return "📊";
  if (mime.includes("zip") || mime.includes("compress")) return "📦";
  if (mime.includes("video")) return "🎬";
  return "📎";
}

const COLORS = ["#6366f1","#2563eb","#16a34a","#dc2626","#d97706","#0891b2","#7c3aed","#db2777","#0f172a"];

export default function ShelfBrowser({
  user, folderId, folders, files, breadcrumb, allFolders, search, view,
}: {
  user: User;
  folderId: string | null;
  folders: Folder[];
  files: ShelfFile[];
  breadcrumb: Crumb[];
  allFolders: FolderOpt[];
  search: string;
  view: "grid" | "list";
}) {
  const router = useRouter();
  const params = useSearchParams();

  const [searchVal, setSearchVal]     = useState(search);
  const [dragging, setDragging]       = useState(false);
  const [showUpload, setShowUpload]   = useState(false);
  const [showFolder, setShowFolder]   = useState(false);
  const [uploading, setUploading]     = useState(false);
  const [upError, setUpError]         = useState("");
  const [selectedFiles, setFiles]     = useState<File[]>([]);
  const [upName, setUpName]           = useState("");
  const [upDesc, setUpDesc]           = useState("");
  const [upFolder, setUpFolder]       = useState(folderId ?? "");
  const [folderName, setFolderName]   = useState("");
  const [folderColor, setFolderColor] = useState("#6366f1");
  const [deleting, setDeleting]       = useState<string | null>(null);
  const [folderUploading, setFolderUploading]   = useState(false);
  const [folderProgress, setFolderProgress]     = useState({ phase: "", current: 0, total: 0 });
  const [settingUpCompanies, setSettingUpCompanies] = useState(false);
  const fileRef   = useRef<HTMLInputElement>(null);
  const folderRef = useRef<HTMLInputElement>(null);

  function nav(p: Record<string, string | null>) {
    const sp = new URLSearchParams(params.toString());
    for (const [k, v] of Object.entries(p)) v === null ? sp.delete(k) : sp.set(k, v);
    router.push(`/files?${sp.toString()}`);
  }

  function openUploadModal(fs: File[]) {
    setFiles(fs);
    setUpName(fs[0].name.replace(/\.[^.]+$/, ""));
    setUpFolder(folderId ?? "");   // always reset to current folder
    setUpError("");
    setShowUpload(true);
  }

  const onDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault(); setDragging(false);
    const fs = Array.from(e.dataTransfer.files);
    if (!fs.length) return;
    openUploadModal(fs);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [folderId]);

  async function upload(e: React.FormEvent) {
    e.preventDefault();
    setUploading(true); setUpError("");
    for (const f of selectedFiles) {
      const fd = new FormData();
      fd.append("file", f);
      fd.append("name", selectedFiles.length === 1 ? upName || f.name : f.name);
      fd.append("description", upDesc);
      if (upFolder) fd.append("folderId", upFolder);
      const r = await fetch("/api/files", { method: "POST", body: fd });
      if (!r.ok) { const d = await r.json().catch(() => ({})); setUpError(d.error ?? "Upload failed"); setUploading(false); return; }
    }
    setUploading(false); setShowUpload(false); setFiles([]); setUpName(""); setUpDesc("");
    router.refresh();
  }

  async function createFolder(e: React.FormEvent) {
    e.preventDefault();
    await fetch("/api/folders", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: folderName, parentId: folderId, color: folderColor }),
    });
    setShowFolder(false); setFolderName(""); router.refresh();
  }

  async function uploadFolderFiles(rawFiles: File[]) {
    if (!rawFiles.length) return;
    setFolderUploading(true);

    // Build unique sorted dir paths (shortest first = top-down)
    const dirs = new Set<string>();
    for (const f of rawFiles) {
      const parts = (f as File & { webkitRelativePath: string }).webkitRelativePath.split("/");
      for (let i = 1; i < parts.length; i++) dirs.add(parts.slice(0, i).join("/"));
    }
    const sortedDirs = Array.from(dirs).sort((a, b) => a.split("/").length - b.split("/").length);

    // Create folders, track path → id
    const folderMap = new Map<string, string>();
    setFolderProgress({ phase: "Creating folders", current: 0, total: sortedDirs.length });
    for (let i = 0; i < sortedDirs.length; i++) {
      const dir = sortedDirs[i];
      const parts = dir.split("/");
      const name = parts[parts.length - 1];
      const parentPath = parts.slice(0, -1).join("/");
      const parentId = parentPath ? (folderMap.get(parentPath) ?? null) : (folderId ?? null);
      const res = await fetch("/api/folders", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, parentId, color: "#6366f1" }),
      });
      const data = await res.json();
      if (data.id) folderMap.set(dir, data.id);
      setFolderProgress({ phase: "Creating folders", current: i + 1, total: sortedDirs.length });
    }

    // Upload files
    setFolderProgress({ phase: "Uploading files", current: 0, total: rawFiles.length });
    for (let i = 0; i < rawFiles.length; i++) {
      const f = rawFiles[i] as File & { webkitRelativePath: string };
      const parts = f.webkitRelativePath.split("/");
      const dirPath = parts.slice(0, -1).join("/");
      const targetFolderId = folderMap.get(dirPath) ?? folderId ?? null;
      const fd = new FormData();
      fd.append("file", f);
      fd.append("name", f.name);
      if (targetFolderId) fd.append("folderId", targetFolderId);
      await fetch("/api/files", { method: "POST", body: fd });
      setFolderProgress({ phase: "Uploading files", current: i + 1, total: rawFiles.length });
    }

    setFolderUploading(false);
    router.refresh();
  }

  async function deleteFile(id: string) {
    if (!confirm("Delete this file? This cannot be undone.")) return;
    setDeleting(id);
    await fetch(`/api/files/${id}`, { method: "DELETE" });
    setDeleting(null); router.refresh();
  }

  async function setupCompanyFolders() {
    if (!confirm("This will create a folder for each Pabari company with standard subfolders. Already-existing companies will be skipped. Continue?")) return;
    setSettingUpCompanies(true);
    const res = await fetch("/api/setup/company-folders", { method: "POST" });
    const data = await res.json();
    setSettingUpCompanies(false);
    if (res.ok) {
      alert(`Done! ${data.created} companies created, ${data.skipped} already existed.`);
      router.refresh();
    } else {
      alert("Setup failed: " + (data.error ?? "unknown error"));
    }
  }

  async function logout() {
    await fetch("/api/auth/logout", { method: "POST" });
    window.location.href = HUB;
  }

  return (
    <div
      style={{ minHeight: "100vh", display: "flex", flexDirection: "column" }}
      onDragOver={e => { e.preventDefault(); setDragging(true); }}
      onDragLeave={() => setDragging(false)}
      onDrop={onDrop}
    >
      {dragging && (
        <div style={{ position: "fixed", inset: 0, background: "#6366f118", border: "3px dashed #6366f1",
          borderRadius: 16, zIndex: 100, display: "flex", alignItems: "center", justifyContent: "center",
          fontSize: 18, fontWeight: 700, color: "#6366f1", pointerEvents: "none" }}>
          Drop files to upload
        </div>
      )}

      {/* Nav */}
      <nav style={{ background: "#0f1a12", borderBottom: "1px solid #1e2e1a", padding: "0 24px",
        display: "flex", alignItems: "center", height: 52, gap: 16, position: "sticky", top: 0, zIndex: 50 }}>
        <span style={{ fontWeight: 900, fontSize: 14, color: "#b5833a", letterSpacing: "0.15em" }}>PABARI</span>
        <span style={{ fontSize: 9, color: "#4a7055", fontWeight: 700, background: "rgba(34,197,94,0.1)",
          border: "1px solid rgba(34,197,94,0.2)", borderRadius: 4, padding: "2px 6px", letterSpacing: "0.06em" }}>SHELF</span>
        <div style={{ flex: 1 }} />
        <span style={{ fontSize: 12, color: "rgba(255,255,255,0.5)" }}>{user.name}</span>
        <button onClick={logout} style={{ background: "none", border: "1px solid rgba(255,255,255,0.12)",
          color: "rgba(255,255,255,0.5)", fontSize: 11, cursor: "pointer", borderRadius: 6, padding: "4px 10px" }}>
          ← Hub
        </button>
      </nav>

      <div style={{ flex: 1, maxWidth: 1200, margin: "0 auto", width: "100%", padding: "32px 24px" }}>
        {/* Header */}
        <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 24, flexWrap: "wrap" }}>
          <div style={{ flex: 1 }}>
            <h1 style={{ fontSize: 24, fontWeight: 800, color: "#0f172a", letterSpacing: "-0.02em" }}>Pabari Shelf</h1>
            <p style={{ fontSize: 13, color: "#64748b", marginTop: 2 }}>Central document library</p>
          </div>
          <form onSubmit={e => { e.preventDefault(); nav({ search: searchVal || null, folder: null }); }}
            style={{ display: "flex", gap: 8 }}>
            <input value={searchVal} onChange={e => setSearchVal(e.target.value)}
              placeholder="Search documents…"
              style={{ border: "1px solid #e2e8f0", borderRadius: 8, padding: "8px 14px", fontSize: 13,
                width: 220, outline: "none", background: "white" }} />
            <button type="submit" style={{ background: "#0f172a", color: "white", border: "none",
              borderRadius: 8, padding: "8px 16px", fontSize: 13, cursor: "pointer", fontWeight: 600 }}>
              Search
            </button>
            {search && <button type="button" onClick={() => { setSearchVal(""); nav({ search: null }); }}
              style={{ background: "white", border: "1px solid #e2e8f0", borderRadius: 8,
                padding: "8px 12px", fontSize: 13, cursor: "pointer", color: "#64748b" }}>✕</button>}
          </form>
          <div style={{ display: "flex", gap: 6 }}>
            <button onClick={() => nav({ view: "grid" })}
              style={{ padding: "8px 12px", borderRadius: 8, border: "1px solid #e2e8f0", cursor: "pointer",
                background: view === "grid" ? "#0f172a" : "white", color: view === "grid" ? "white" : "#64748b", fontSize: 14 }}>⊞</button>
            <button onClick={() => nav({ view: "list" })}
              style={{ padding: "8px 12px", borderRadius: 8, border: "1px solid #e2e8f0", cursor: "pointer",
                background: view === "list" ? "#0f172a" : "white", color: view === "list" ? "white" : "#64748b", fontSize: 14 }}>≡</button>
          </div>
          {user.role === "admin" && !folderId && (
            <button onClick={setupCompanyFolders} disabled={settingUpCompanies}
              style={{ background: "white", border: "1px solid #b5833a", color: "#b5833a", borderRadius: 8,
                padding: "8px 16px", fontSize: 13, cursor: settingUpCompanies ? "wait" : "pointer", fontWeight: 600,
                opacity: settingUpCompanies ? 0.7 : 1 }}>
              {settingUpCompanies ? "Setting up…" : "Setup company folders"}
            </button>
          )}
          <button onClick={() => setShowFolder(true)}
            style={{ background: "white", border: "1px solid #e2e8f0", color: "#374151", borderRadius: 8,
              padding: "8px 16px", fontSize: 13, cursor: "pointer", fontWeight: 600 }}>
            + New folder
          </button>
          <button onClick={() => folderRef.current?.click()}
            style={{ background: "white", border: "1px solid #6366f1", color: "#6366f1", borderRadius: 8,
              padding: "8px 16px", fontSize: 13, cursor: "pointer", fontWeight: 600 }}>
            Upload Folder
          </button>
          <button onClick={() => fileRef.current?.click()}
            style={{ background: "#6366f1", color: "white", border: "none", borderRadius: 8,
              padding: "8px 16px", fontSize: 13, cursor: "pointer", fontWeight: 600 }}>
            Upload Files
          </button>
          <input ref={fileRef} type="file" multiple style={{ display: "none" }}
            onChange={e => {
              const fs = Array.from(e.target.files ?? []);
              if (!fs.length) return;
              openUploadModal(fs);
              e.target.value = "";
            }} />
          <input ref={folderRef} type="file" style={{ display: "none" }}
            // @ts-expect-error webkitdirectory is non-standard but widely supported
            webkitdirectory=""
            onChange={e => {
              const fs = Array.from(e.target.files ?? []);
              if (fs.length) uploadFolderFiles(fs);
              e.target.value = "";
            }} />
        </div>

        {/* Breadcrumb */}
        {!search && (
          <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 24, fontSize: 13 }}>
            <button onClick={() => nav({ folder: null, search: null })}
              style={{ background: "white", border: "1px solid #e2e8f0", borderRadius: 6,
                padding: "4px 12px", cursor: "pointer", fontWeight: 600, color: "#374151" }}>
              📁 Pabari Shelf
            </button>
            {breadcrumb.map(c => (
              <span key={c.id} style={{ display: "flex", alignItems: "center", gap: 6 }}>
                <span style={{ color: "#cbd5e1" }}>›</span>
                <button onClick={() => nav({ folder: c.id })}
                  style={{ background: "white", border: "1px solid #e2e8f0", borderRadius: 6,
                    padding: "4px 12px", cursor: "pointer", color: "#374151" }}>
                  {c.name}
                </button>
              </span>
            ))}
          </div>
        )}

        {search && (
          <p style={{ color: "#64748b", fontSize: 13, marginBottom: 20 }}>
            {files.length} result{files.length !== 1 ? "s" : ""} for "{search}"
          </p>
        )}

        {/* Folders */}
        {!search && folders.length > 0 && (
          <>
            <p style={{ fontSize: 11, fontWeight: 700, color: "#94a3b8", letterSpacing: "0.08em",
              textTransform: "uppercase", marginBottom: 12 }}>Folders</p>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(180px, 1fr))",
              gap: 12, marginBottom: 32 }}>
              {folders.map(f => (
                <button key={f.id} onClick={() => nav({ folder: f.id })}
                  style={{ background: "white", border: "1.5px solid #e2e8f0", borderRadius: 12,
                    padding: "18px 16px", cursor: "pointer", textAlign: "left",
                    transition: "border-color 0.15s, box-shadow 0.15s", display: "flex", flexDirection: "column", gap: 8 }}
                  onMouseEnter={e => { (e.currentTarget as HTMLButtonElement).style.borderColor = f.color; (e.currentTarget as HTMLButtonElement).style.boxShadow = `0 2px 12px ${f.color}22`; }}
                  onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.borderColor = "#e2e8f0"; (e.currentTarget as HTMLButtonElement).style.boxShadow = "none"; }}>
                  <div style={{ fontSize: 28 }}>📁</div>
                  <div style={{ fontWeight: 700, fontSize: 13, color: "#0f172a" }}>{f.name}</div>
                  <div style={{ fontSize: 11, color: "#94a3b8" }}>{f.file_count} file{f.file_count !== "1" ? "s" : ""}</div>
                  <div style={{ height: 3, borderRadius: 2, background: f.color, marginTop: 4 }} />
                </button>
              ))}
            </div>
          </>
        )}

        {/* Files */}
        {files.length > 0 && (
          <>
            <p style={{ fontSize: 11, fontWeight: 700, color: "#94a3b8", letterSpacing: "0.08em",
              textTransform: "uppercase", marginBottom: 12 }}>
              {search ? "Files" : "Files in this folder"}
            </p>

            {view === "grid" ? (
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(180px, 1fr))", gap: 12 }}>
                {files.map(f => (
                  <div key={f.id} style={{ background: "white", border: "1.5px solid #e2e8f0",
                    borderRadius: 10, padding: "16px 14px", position: "relative" }}
                    onMouseEnter={e => (e.currentTarget as HTMLDivElement).style.borderColor = "#6366f1"}
                    onMouseLeave={e => (e.currentTarget as HTMLDivElement).style.borderColor = "#e2e8f0"}>
                    <a href={`/api/files/${f.id}`} target="_blank" rel="noreferrer"
                      style={{ textDecoration: "none", display: "block" }}>
                      <div style={{ fontSize: 28, marginBottom: 10 }}>{mimeEmoji(f.mime_type)}</div>
                      <div style={{ fontWeight: 600, fontSize: 13, color: "#0f172a", marginBottom: 4,
                        overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{f.name}</div>
                      <div style={{ fontSize: 11, color: "#94a3b8" }}>{fmtBytes(f.file_size)}</div>
                      <div style={{ fontSize: 11, color: "#94a3b8", marginTop: 2 }}>
                        {new Date(f.created_at).toLocaleDateString("en-KE")}
                      </div>
                    </a>
                    <button onClick={() => deleteFile(f.id)} disabled={deleting === f.id}
                      style={{ position: "absolute", top: 8, right: 8, background: "none", border: "none",
                        cursor: "pointer", color: "#cbd5e1", fontSize: 14, padding: 4 }}
                      onMouseEnter={e => (e.currentTarget as HTMLButtonElement).style.color = "#dc2626"}
                      onMouseLeave={e => (e.currentTarget as HTMLButtonElement).style.color = "#cbd5e1"}>
                      {deleting === f.id ? "…" : "✕"}
                    </button>
                  </div>
                ))}
              </div>
            ) : (
              <div style={{ background: "white", borderRadius: 12, border: "1px solid #e2e8f0", overflow: "hidden" }}>
                <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
                  <thead>
                    <tr style={{ background: "#f8fafc", borderBottom: "1px solid #e2e8f0" }}>
                      {["Name", "Size", "Uploaded by", "Date", ""].map(h => (
                        <th key={h} style={{ padding: "10px 16px", textAlign: "left", fontSize: 11,
                          fontWeight: 700, color: "#94a3b8", textTransform: "uppercase", letterSpacing: "0.06em" }}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {files.map((f, i) => (
                      <tr key={f.id} style={{ borderBottom: i < files.length - 1 ? "1px solid #f1f5f9" : "none" }}>
                        <td style={{ padding: "12px 16px" }}>
                          <a href={`/api/files/${f.id}`} target="_blank" rel="noreferrer"
                            style={{ display: "flex", alignItems: "center", gap: 8, textDecoration: "none", color: "#0f172a", fontWeight: 600 }}>
                            <span style={{ fontSize: 18 }}>{mimeEmoji(f.mime_type)}</span>
                            {f.name}
                          </a>
                          {f.description && <p style={{ fontSize: 11, color: "#94a3b8", marginTop: 2, marginLeft: 26 }}>{f.description}</p>}
                        </td>
                        <td style={{ padding: "12px 16px", color: "#64748b" }}>{fmtBytes(f.file_size)}</td>
                        <td style={{ padding: "12px 16px", color: "#64748b" }}>{f.uploaded_by.split("@")[0]}</td>
                        <td style={{ padding: "12px 16px", color: "#64748b" }}>{new Date(f.created_at).toLocaleDateString("en-KE")}</td>
                        <td style={{ padding: "12px 16px" }}>
                          <button onClick={() => deleteFile(f.id)} disabled={deleting === f.id}
                            style={{ background: "none", border: "none", cursor: "pointer", color: "#cbd5e1", fontSize: 13 }}
                            onMouseEnter={e => (e.currentTarget as HTMLButtonElement).style.color = "#dc2626"}
                            onMouseLeave={e => (e.currentTarget as HTMLButtonElement).style.color = "#cbd5e1"}>
                            {deleting === f.id ? "…" : "Delete"}
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </>
        )}

        {!search && folders.length === 0 && files.length === 0 && (
          <div style={{ background: "white", borderRadius: 16, border: "1px solid #e2e8f0",
            padding: "64px 24px", textAlign: "center" }}>
            <div style={{ fontSize: 48, marginBottom: 16 }}>📁</div>
            <h2 style={{ fontSize: 18, fontWeight: 700, color: "#0f172a", marginBottom: 8 }}>Nothing here yet</h2>
            <p style={{ color: "#64748b", fontSize: 13 }}>Create a folder or drag files anywhere to upload.</p>
          </div>
        )}
      </div>

      {/* Upload modal */}
      {showUpload && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.4)", zIndex: 200,
          display: "flex", alignItems: "center", justifyContent: "center" }}
          onClick={() => setShowUpload(false)}>
          <div style={{ background: "white", borderRadius: 16, padding: "32px 28px", width: "100%",
            maxWidth: 440, maxHeight: "90vh", overflowY: "auto",
            boxShadow: "0 20px 60px rgba(0,0,0,0.15)" }} onClick={e => e.stopPropagation()}>
            <h2 style={{ fontSize: 18, fontWeight: 800, marginBottom: 20 }}>Upload to Shelf</h2>
            <form onSubmit={upload}>
              <div style={{ marginBottom: 14 }}>
                <label style={{ fontSize: 12, fontWeight: 600, color: "#374151", display: "block", marginBottom: 6 }}>
                  Files selected ({selectedFiles.length})
                </label>
                <div style={{ background: "#f8fafc", border: "1px solid #e2e8f0", borderRadius: 8,
                  padding: "10px 14px", fontSize: 13, maxHeight: 160, overflowY: "auto" }}>
                  {selectedFiles.length === 0
                    ? <span style={{ color: "#94a3b8" }}>No files selected</span>
                    : selectedFiles.map(f => <div key={f.name} style={{ color: "#374151" }}>{f.name} ({fmtBytes(f.size)})</div>)
                  }
                </div>
              </div>
              {selectedFiles.length === 1 && (
                <div style={{ marginBottom: 14 }}>
                  <label style={{ fontSize: 12, fontWeight: 600, color: "#374151", display: "block", marginBottom: 6 }}>Display name</label>
                  <input value={upName} onChange={e => setUpName(e.target.value)} required
                    style={{ width: "100%", border: "1px solid #e2e8f0", borderRadius: 8,
                      padding: "9px 14px", fontSize: 13, outline: "none" }} />
                </div>
              )}
              <div style={{ marginBottom: 14 }}>
                <label style={{ fontSize: 12, fontWeight: 600, color: "#374151", display: "block", marginBottom: 6 }}>Description (optional)</label>
                <input value={upDesc} onChange={e => setUpDesc(e.target.value)} placeholder="Brief description…"
                  style={{ width: "100%", border: "1px solid #e2e8f0", borderRadius: 8, padding: "9px 14px", fontSize: 13, outline: "none" }} />
              </div>
              <div style={{ marginBottom: 20 }}>
                <label style={{ fontSize: 12, fontWeight: 600, color: "#374151", display: "block", marginBottom: 6 }}>Save to folder</label>
                <select value={upFolder} onChange={e => setUpFolder(e.target.value)}
                  style={{ width: "100%", border: "1px solid #e2e8f0", borderRadius: 8,
                    padding: "9px 14px", fontSize: 13, outline: "none", background: "white" }}>
                  {folderId
                    ? <option value={folderId}>📂 {breadcrumb[breadcrumb.length - 1]?.name ?? "Current folder"} (current)</option>
                    : <option value="">📁 Root — Pabari Shelf</option>
                  }
                  {allFolders.filter(f => f.id !== folderId).map(f => (
                    <option key={f.id} value={f.id}>{f.name}</option>
                  ))}
                </select>
              </div>
              {upError && <p style={{ color: "#dc2626", fontSize: 12, marginBottom: 12 }}>{upError}</p>}
              <div style={{ display: "flex", gap: 8, justifyContent: "flex-end" }}>
                <button type="button" onClick={() => setShowUpload(false)}
                  style={{ background: "white", border: "1px solid #e2e8f0", borderRadius: 8,
                    padding: "9px 18px", fontSize: 13, cursor: "pointer", color: "#374151" }}>Cancel</button>
                <button type="submit" disabled={uploading || !selectedFiles.length}
                  style={{ background: uploading ? "#a5b4fc" : "#6366f1", color: "white", border: "none",
                    borderRadius: 8, padding: "9px 18px", fontSize: 13, cursor: "pointer", fontWeight: 600 }}>
                  {uploading ? "Uploading…" : `Upload ${selectedFiles.length > 1 ? `${selectedFiles.length} files` : "file"}`}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Folder upload progress overlay */}
      {folderUploading && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.5)", zIndex: 300,
          display: "flex", alignItems: "center", justifyContent: "center" }}>
          <div style={{ background: "white", borderRadius: 16, padding: "40px 36px", width: "100%",
            maxWidth: 400, textAlign: "center", boxShadow: "0 20px 60px rgba(0,0,0,0.2)" }}>
            <div style={{ fontSize: 40, marginBottom: 16 }}>📂</div>
            <h2 style={{ fontSize: 18, fontWeight: 800, color: "#0f172a", marginBottom: 8 }}>Uploading folder…</h2>
            <p style={{ fontSize: 13, color: "#64748b", marginBottom: 20 }}>{folderProgress.phase}</p>
            <div style={{ background: "#f1f5f9", borderRadius: 99, height: 8, overflow: "hidden", marginBottom: 12 }}>
              <div style={{
                height: "100%", borderRadius: 99, background: "#6366f1", transition: "width 0.3s",
                width: folderProgress.total ? `${(folderProgress.current / folderProgress.total) * 100}%` : "0%",
              }} />
            </div>
            <p style={{ fontSize: 12, color: "#94a3b8" }}>
              {folderProgress.current} / {folderProgress.total}
            </p>
          </div>
        </div>
      )}

      {/* New folder modal */}
      {showFolder && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.4)", zIndex: 200,
          display: "flex", alignItems: "center", justifyContent: "center" }}
          onClick={() => setShowFolder(false)}>
          <div style={{ background: "white", borderRadius: 16, padding: "32px 28px", width: "100%",
            maxWidth: 380, boxShadow: "0 20px 60px rgba(0,0,0,0.15)" }} onClick={e => e.stopPropagation()}>
            <h2 style={{ fontSize: 18, fontWeight: 800, marginBottom: 20 }}>New Folder</h2>
            <form onSubmit={createFolder}>
              <div style={{ marginBottom: 16 }}>
                <label style={{ fontSize: 12, fontWeight: 600, color: "#374151", display: "block", marginBottom: 6 }}>Folder name</label>
                <input autoFocus value={folderName} onChange={e => setFolderName(e.target.value)} required
                  placeholder="e.g. Lease Agreements 2026"
                  style={{ width: "100%", border: "1px solid #e2e8f0", borderRadius: 8,
                    padding: "9px 14px", fontSize: 13, outline: "none" }} />
              </div>
              <div style={{ marginBottom: 24 }}>
                <label style={{ fontSize: 12, fontWeight: 600, color: "#374151", display: "block", marginBottom: 8 }}>Colour</label>
                <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                  {COLORS.map(c => (
                    <button key={c} type="button" onClick={() => setFolderColor(c)}
                      style={{ width: 28, height: 28, borderRadius: "50%", background: c, border: "none",
                        cursor: "pointer", outline: folderColor === c ? `3px solid ${c}` : "none", outlineOffset: 2 }} />
                  ))}
                </div>
              </div>
              <div style={{ display: "flex", gap: 8, justifyContent: "flex-end" }}>
                <button type="button" onClick={() => setShowFolder(false)}
                  style={{ background: "white", border: "1px solid #e2e8f0", borderRadius: 8,
                    padding: "9px 18px", fontSize: 13, cursor: "pointer", color: "#374151" }}>Cancel</button>
                <button type="submit" disabled={!folderName.trim()}
                  style={{ background: "#6366f1", color: "white", border: "none", borderRadius: 8,
                    padding: "9px 18px", fontSize: 13, cursor: "pointer", fontWeight: 600 }}>
                  Create
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
