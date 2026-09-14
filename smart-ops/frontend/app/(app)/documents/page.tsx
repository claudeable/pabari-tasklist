"use client";

import { useMemo, useRef, useState } from "react";
import { ArrowLeft, CheckSquare, FileText, Folder, FolderInput, FolderPlus, Trash2, Upload, X } from "lucide-react";
import { toast } from "sonner";
import { PageHeader } from "@/components/ui-custom/page-header";
import { EmptyState } from "@/components/ui-custom/empty-state";
import { ErrorState } from "@/components/ui-custom/error-state";
import { StatusPill } from "@/components/ui-custom/status-pill";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { useProjects } from "@/lib/hooks/use-projects";
import {
  useCreateDocument,
  useDeleteDocument,
  useDocuments,
  useUpdateDocument,
  useUploadDocumentFile,
} from "@/lib/hooks/use-documents";
import { API_BASE_URL } from "@/lib/api-client";
import type { DocumentRecord } from "@/lib/types";
import { formatTimestamp } from "@/components/ui-custom/activity-row";

function fileUrl(doc: DocumentRecord): string | null {
  if (!doc.file_url) return null;
  if (doc.file_url.startsWith("/api/v1/"))
    return `${API_BASE_URL.replace("/api/v1", "")}${doc.file_url}`;
  return doc.file_url;
}

export default function DocumentsPage() {
  const { data: projects } = useProjects();
  const [projectId, setProjectId] = useState<string>("");
  const { data, isLoading, isError, refetch } = useDocuments(projectId || undefined);
  const deleteDocument = useDeleteDocument();
  const updateDocument = useUpdateDocument();

  // Folder navigation state
  const [currentFolder, setCurrentFolder] = useState<string | null>(null);
  // Locally created empty folders (disappear on refresh if no docs added)
  const [localFolders, setLocalFolders] = useState<string[]>([]);

  // Selection state
  const [selectMode, setSelectMode] = useState(false);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [moveOpen, setMoveOpen] = useState(false);

  // Dialog state
  const [newFolderOpen, setNewFolderOpen] = useState(false);
  const [uploadOpen, setUploadOpen] = useState(false);
  const [detail, setDetail] = useState<DocumentRecord | null>(null);

  function toggleSelect(id: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  }

  function exitSelectMode() {
    setSelectMode(false);
    setSelected(new Set());
  }

  async function handleBulkMove(targetFolder: string) {
    const ids = Array.from(selected);
    let ok = 0;
    for (const id of ids) {
      try {
        await updateDocument.mutateAsync({ id, payload: { folder: targetFolder || undefined } });
        ok++;
      } catch { /* continue */ }
    }
    toast.success(ok === ids.length ? `Moved ${ok} document${ok !== 1 ? "s" : ""}` : `Moved ${ok} of ${ids.length}`);
    exitSelectMode();
    setMoveOpen(false);
  }

  const documents = useMemo(() => data ?? [], [data]);

  // All unique folder names from documents
  const documentFolderNames = useMemo(
    () => [...new Set(documents.map((d) => d.folder).filter(Boolean) as string[])],
    [documents],
  );

  // Merged with local empty folders
  const allFolderNames = useMemo(
    () => [...new Set([...documentFolderNames, ...localFolders])].sort(),
    [documentFolderNames, localFolders],
  );

  // Doc count per folder
  const folderCounts = useMemo(() => {
    const counts: Record<string, number> = {};
    for (const doc of documents) {
      if (doc.folder) counts[doc.folder] = (counts[doc.folder] ?? 0) + 1;
    }
    return counts;
  }, [documents]);

  // Docs shown in current view
  const visibleDocs = useMemo(() => {
    if (currentFolder === null) return documents.filter((d) => !d.folder);
    return documents.filter((d) => d.folder === currentFolder);
  }, [documents, currentFolder]);

  function handleDelete(id: string) {
    deleteDocument.mutate(id, {
      onSuccess: () => {
        toast.success("Document deleted");
        setDetail(null);
      },
      onError: () => toast.error("Failed to delete document"),
    });
  }

  function handleNewFolderCreated(name: string) {
    setLocalFolders((prev) => (prev.includes(name) ? prev : [...prev, name]));
    setCurrentFolder(name);
  }

  const isRoot = currentFolder === null;

  return (
    <div>
      <PageHeader
        title="Documents"
        description="Centralized document repository shared across both organizations."
        actions={
          <div className="flex items-center gap-2">
            <Select
              value={projectId || "all"}
              onValueChange={(v) => setProjectId(v === "all" ? "" : v)}
            >
              <SelectTrigger className="w-44">
                <SelectValue placeholder="All projects" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All projects</SelectItem>
                {(projects ?? []).map((p) => (
                  <SelectItem key={p.id} value={p.id}>
                    {p.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            {isRoot && (
              <Button
                variant="outline"
                size="sm"
                className="gap-1.5"
                onClick={() => setNewFolderOpen(true)}
              >
                <FolderPlus className="h-3.5 w-3.5" />
                New Folder
              </Button>
            )}

            {!selectMode ? (
              <Button
                variant="outline"
                size="sm"
                className="gap-1.5"
                onClick={() => setSelectMode(true)}
              >
                <CheckSquare className="h-3.5 w-3.5" />
                Select
              </Button>
            ) : (
              <Button variant="ghost" size="sm" className="gap-1.5" onClick={exitSelectMode}>
                <X className="h-3.5 w-3.5" />
                Cancel
              </Button>
            )}

            <Button size="sm" className="gap-1.5" onClick={() => setUploadOpen(true)}>
              <Upload className="h-3.5 w-3.5" />
              Upload Document
            </Button>
          </div>
        }
      />

      {isLoading ? (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {Array.from({ length: 8 }).map((_, i) => (
            <Skeleton key={i} className="h-24 rounded-xl" />
          ))}
        </div>
      ) : isError ? (
        <ErrorState onRetry={() => refetch()} />
      ) : (
        <div className="space-y-6">
          {/* Breadcrumb / back button */}
          {!isRoot && (
            <div className="flex items-center gap-3">
              <Button
                variant="ghost"
                size="sm"
                className="gap-1.5 text-muted-foreground"
                onClick={() => setCurrentFolder(null)}
              >
                <ArrowLeft className="h-4 w-4" />
                All folders
              </Button>
              <span className="text-muted-foreground">/</span>
              <div className="flex items-center gap-1.5 text-sm font-semibold text-foreground">
                <Folder className="h-4 w-4 text-primary" />
                {currentFolder}
              </div>
            </div>
          )}

          {/* Root: folder cards grid */}
          {isRoot && allFolderNames.length > 0 && (
            <div>
              <p className="mb-3 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                Folders
              </p>
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
                {allFolderNames.map((name) => (
                  <button
                    key={name}
                    onClick={() => setCurrentFolder(name)}
                    className="group flex flex-col items-start gap-2 rounded-xl border border-border bg-card p-4 text-left transition-all hover:border-primary hover:shadow-md"
                  >
                    <Folder className="h-8 w-8 text-primary transition-transform group-hover:scale-110" />
                    <div>
                      <p className="text-sm font-semibold text-foreground line-clamp-1">{name}</p>
                      <p className="text-xs text-muted-foreground">
                        {folderCounts[name] ?? 0}{" "}
                        {(folderCounts[name] ?? 0) === 1 ? "document" : "documents"}
                      </p>
                    </div>
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Documents section */}
          {isRoot && (
            <div>
              {allFolderNames.length > 0 && (
                <p className="mb-3 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                  Unfiled documents
                </p>
              )}
              {visibleDocs.length === 0 && allFolderNames.length === 0 ? (
                <EmptyState
                  icon={FileText}
                  title="No documents yet"
                  description="Create a folder and upload your first document."
                  action={
                    <div className="flex gap-2">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setNewFolderOpen(true)}
                        className="gap-1.5"
                      >
                        <FolderPlus className="h-3.5 w-3.5" />
                        New Folder
                      </Button>
                      <Button size="sm" onClick={() => setUploadOpen(true)} className="gap-1.5">
                        <Upload className="h-3.5 w-3.5" />
                        Upload Document
                      </Button>
                    </div>
                  }
                />
              ) : visibleDocs.length === 0 ? (
                <p className="text-sm text-muted-foreground">No unfiled documents.</p>
              ) : (
                <DocumentGrid
                  docs={visibleDocs}
                  onOpen={selectMode ? undefined : setDetail}
                  selectMode={selectMode}
                  selected={selected}
                  onToggleSelect={toggleSelect}
                />
              )}
            </div>
          )}

          {/* Inside folder */}
          {!isRoot && (
            <div>
              {visibleDocs.length === 0 ? (
                <EmptyState
                  icon={FileText}
                  title="No documents in this folder"
                  description="Upload a document to add it here."
                  action={
                    <Button size="sm" onClick={() => setUploadOpen(true)} className="gap-1.5">
                      <Upload className="h-3.5 w-3.5" />
                      Upload Document
                    </Button>
                  }
                />
              ) : (
                <DocumentGrid
                  docs={visibleDocs}
                  onOpen={selectMode ? undefined : setDetail}
                  selectMode={selectMode}
                  selected={selected}
                  onToggleSelect={toggleSelect}
                />
              )}
            </div>
          )}
        </div>
      )}

      {/* Floating bulk action bar */}
      {selectMode && selected.size > 0 && (
        <div className="fixed bottom-6 left-1/2 z-50 -translate-x-1/2 flex items-center gap-3 rounded-xl border border-border bg-card px-4 py-3 shadow-xl">
          <span className="text-sm font-medium text-foreground">{selected.size} selected</span>
          <Button
            size="sm"
            className="gap-1.5"
            onClick={() => setMoveOpen(true)}
          >
            <FolderInput className="h-3.5 w-3.5" />
            Move to folder
          </Button>
          <Button size="sm" variant="ghost" className="gap-1.5" onClick={() => setSelected(new Set())}>
            Clear
          </Button>
        </div>
      )}

      {/* Document detail sheet */}
      <Sheet open={Boolean(detail)} onOpenChange={(open) => !open && setDetail(null)}>
        <SheetContent side="right" className="w-full sm:max-w-md">
          {detail ? (
            <>
              <SheetHeader>
                <SheetTitle>{detail.name}</SheetTitle>
                <SheetDescription>
                  {detail.folder ? `📁 ${detail.folder}` : "Unfiled"}
                </SheetDescription>
              </SheetHeader>
              <div className="space-y-4 px-4 pb-4">
                <div className="flex items-center justify-between text-sm">
                  <span className="text-muted-foreground">Status</span>
                  {detail.status ? <StatusPill status={detail.status} /> : "—"}
                </div>
                <div className="flex items-center justify-between text-sm">
                  <span className="text-muted-foreground">Version</span>
                  <span>v{detail.version ?? 1}</span>
                </div>
                <div className="flex items-center justify-between text-sm">
                  <span className="text-muted-foreground">Created</span>
                  <span>{formatTimestamp(detail.created_at)}</span>
                </div>
                {fileUrl(detail) ? (
                  <Button variant="outline" size="sm" asChild className="w-full">
                    <a href={fileUrl(detail)!} target="_blank" rel="noreferrer">
                      Open file
                    </a>
                  </Button>
                ) : null}
                <Button
                  variant="destructive"
                  size="sm"
                  className="w-full gap-1.5"
                  onClick={() => handleDelete(detail.id)}
                  disabled={deleteDocument.isPending}
                >
                  <Trash2 className="h-3.5 w-3.5" />
                  Delete document
                </Button>
              </div>
            </>
          ) : null}
        </SheetContent>
      </Sheet>

      {/* New Folder dialog */}
      <NewFolderDialog
        open={newFolderOpen}
        onOpenChange={setNewFolderOpen}
        existingFolders={allFolderNames}
        onCreated={handleNewFolderCreated}
      />

      {/* Upload dialog */}
      <UploadDocumentDialog
        open={uploadOpen}
        onOpenChange={setUploadOpen}
        defaultFolder={currentFolder ?? ""}
        defaultProjectId={projectId}
        existingFolders={allFolderNames}
      />

      {/* Move to folder dialog */}
      <MoveToFolderDialog
        open={moveOpen}
        onOpenChange={setMoveOpen}
        count={selected.size}
        existingFolders={allFolderNames}
        isBusy={updateDocument.isPending}
        onMove={handleBulkMove}
      />
    </div>
  );
}

function DocumentGrid({
  docs,
  onOpen,
  selectMode = false,
  selected = new Set(),
  onToggleSelect,
}: {
  docs: DocumentRecord[];
  onOpen?: (doc: DocumentRecord) => void;
  selectMode?: boolean;
  selected?: Set<string>;
  onToggleSelect?: (id: string) => void;
}) {
  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
      {docs.map((doc) => {
        const isSelected = selected.has(doc.id);
        return (
          <Card
            key={doc.id}
            className={`glass-panel cursor-pointer transition-shadow hover:shadow-md ${isSelected ? "ring-2 ring-primary" : ""}`}
            onClick={() => {
              if (selectMode) onToggleSelect?.(doc.id);
              else onOpen?.(doc);
            }}
          >
            <CardContent className="space-y-2">
              <div className="flex items-start gap-2">
                {selectMode && (
                  <div className={`mt-0.5 h-4 w-4 shrink-0 rounded border-2 ${isSelected ? "border-primary bg-primary" : "border-muted-foreground"}`} />
                )}
                {!selectMode && <FileText className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" />}
                <div className="min-w-0 flex-1">
                  <p className="line-clamp-1 text-sm font-semibold text-foreground">{doc.name}</p>
                  {doc.status ? (
                    <div className="mt-1">
                      <StatusPill status={doc.status} />
                    </div>
                  ) : null}
                </div>
              </div>
              <div className="flex items-center justify-between text-xs text-muted-foreground">
                <span>v{doc.version ?? 1}</span>
                <span>{formatTimestamp(doc.created_at)}</span>
              </div>
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
}

function NewFolderDialog({
  open,
  onOpenChange,
  existingFolders,
  onCreated,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  existingFolders: string[];
  onCreated: (name: string) => void;
}) {
  const [name, setName] = useState("");

  function handleCreate() {
    const trimmed = name.trim();
    if (!trimmed) {
      toast.error("Folder name is required");
      return;
    }
    if (existingFolders.some((f) => f.toLowerCase() === trimmed.toLowerCase())) {
      toast.error("A folder with that name already exists");
      return;
    }
    onCreated(trimmed);
    setName("");
    onOpenChange(false);
    toast.success(`Folder "${trimmed}" created`);
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>New Folder</DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          <div className="space-y-1.5">
            <Label htmlFor="folder-name">Folder name</Label>
            <Input
              id="folder-name"
              placeholder="e.g. Contracts, Reports, Legal…"
              value={name}
              onChange={(e) => setName(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleCreate()}
              autoFocus
            />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={handleCreate}>Create Folder</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function UploadDocumentDialog({
  open,
  onOpenChange,
  defaultFolder,
  defaultProjectId,
  existingFolders,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  defaultFolder: string;
  defaultProjectId: string;
  existingFolders: string[];
}) {
  const { data: projects } = useProjects();
  const createDocument = useCreateDocument();
  const uploadFile = useUploadDocumentFile();

  const [folder, setFolder] = useState(defaultFolder);
  const [newFolderName, setNewFolderName] = useState("");
  const [folderMode, setFolderMode] = useState<"existing" | "new">(
    defaultFolder ? "existing" : existingFolders.length > 0 ? "existing" : "new",
  );
  const [files, setFiles] = useState<File[]>([]);
  const [projectId, setProjectId] = useState(defaultProjectId || "");
  const [progress, setProgress] = useState<{ done: number; total: number } | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const effectiveFolder = folderMode === "new" ? newFolderName.trim() : folder;

  function reset() {
    setFolder(defaultFolder);
    setNewFolderName("");
    setFolderMode(defaultFolder ? "existing" : existingFolders.length > 0 ? "existing" : "new");
    setFiles([]);
    setProgress(null);
    if (fileInputRef.current) fileInputRef.current.value = "";
  }

  function removeFile(index: number) {
    setFiles((prev) => prev.filter((_, i) => i !== index));
  }

  async function handleSubmit() {
    if (!projectId) {
      toast.error("Please select a project");
      return;
    }
    if (files.length === 0) {
      toast.error("Please choose at least one file");
      return;
    }

    let succeeded = 0;
    let failed = 0;
    setProgress({ done: 0, total: files.length });

    for (let i = 0; i < files.length; i++) {
      const f = files[i];
      const docName = f.name.replace(/\.[^.]+$/, "");
      try {
        const doc = await createDocument.mutateAsync({
          name: docName,
          folder: effectiveFolder || undefined,
          status: "draft",
          project_id: projectId,
        });
        await uploadFile.mutateAsync({ id: doc.id, file: f });
        succeeded++;
      } catch {
        failed++;
      }
      setProgress({ done: i + 1, total: files.length });
    }

    if (failed === 0) {
      toast.success(succeeded === 1 ? "Document uploaded" : `${succeeded} documents uploaded`);
    } else {
      toast.error(`${succeeded} uploaded, ${failed} failed`);
    }
    reset();
    onOpenChange(false);
  }

  const isBusy = progress !== null && progress.done < progress.total;

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!v && !isBusy) reset(); onOpenChange(v); }}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Upload Documents</DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          {/* File picker */}
          <div className="space-y-1.5">
            <Label>Files</Label>
            <input
              ref={fileInputRef}
              type="file"
              multiple
              className="hidden"
              onChange={(e) => {
                const picked = Array.from(e.target.files ?? []);
                setFiles((prev) => {
                  const existing = new Set(prev.map((f) => f.name + f.size));
                  return [...prev, ...picked.filter((f) => !existing.has(f.name + f.size))];
                });
                if (fileInputRef.current) fileInputRef.current.value = "";
              }}
            />
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              className="flex w-full items-center gap-2 rounded-md border border-dashed border-input bg-background px-3 py-3 text-sm text-muted-foreground hover:border-primary hover:text-foreground transition-colors"
            >
              <Upload className="h-4 w-4 shrink-0" />
              <span>
                {files.length === 0
                  ? "Choose files — you can select multiple at once"
                  : `Add more files (${files.length} selected)`}
              </span>
            </button>
            {files.length > 0 && (
              <ul className="max-h-36 overflow-y-auto space-y-1 rounded-md border border-border bg-muted/40 p-2">
                {files.map((f, i) => (
                  <li key={i} className="flex items-center justify-between gap-2 text-xs">
                    <span className="truncate text-foreground">{f.name}</span>
                    <div className="flex shrink-0 items-center gap-2 text-muted-foreground">
                      <span>{(f.size / 1024).toFixed(0)} KB</span>
                      <button
                        type="button"
                        onClick={() => removeFile(i)}
                        className="text-destructive hover:text-destructive/80"
                        aria-label="Remove"
                      >
                        ×
                      </button>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </div>

          {/* Folder */}
          <div className="space-y-1.5">
            <Label>Folder</Label>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => setFolderMode("existing")}
                className={`flex-1 rounded-md border px-3 py-1.5 text-xs font-medium transition-colors ${folderMode === "existing" ? "border-primary bg-primary/10 text-primary" : "border-border text-muted-foreground hover:border-primary"}`}
              >
                Existing folder
              </button>
              <button
                type="button"
                onClick={() => setFolderMode("new")}
                className={`flex-1 rounded-md border px-3 py-1.5 text-xs font-medium transition-colors ${folderMode === "new" ? "border-primary bg-primary/10 text-primary" : "border-border text-muted-foreground hover:border-primary"}`}
              >
                New folder
              </button>
            </div>
            {folderMode === "existing" ? (
              existingFolders.length > 0 ? (
                <Select value={folder} onValueChange={setFolder}>
                  <SelectTrigger className="w-full">
                    <SelectValue placeholder="No folder (unfiled)" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="">No folder (unfiled)</SelectItem>
                    {existingFolders.map((f) => (
                      <SelectItem key={f} value={f}>{f}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              ) : (
                <p className="text-xs text-muted-foreground">No folders yet — create one first.</p>
              )
            ) : (
              <Input
                placeholder="New folder name…"
                value={newFolderName}
                onChange={(e) => setNewFolderName(e.target.value)}
              />
            )}
          </div>

          {/* Project */}
          <div className="space-y-1.5">
            <Label htmlFor="up-project">Project</Label>
            <Select value={projectId} onValueChange={setProjectId}>
              <SelectTrigger id="up-project" className="w-full">
                <SelectValue placeholder="Select project" />
              </SelectTrigger>
              <SelectContent>
                {(projects ?? []).map((p) => (
                  <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Progress bar */}
          {progress && (
            <div className="space-y-1">
              <div className="h-1.5 w-full overflow-hidden rounded-full bg-muted">
                <div
                  className="h-full rounded-full bg-primary transition-all"
                  style={{ width: `${Math.round((progress.done / progress.total) * 100)}%` }}
                />
              </div>
              <p className="text-xs text-muted-foreground text-right">
                {progress.done} / {progress.total}
              </p>
            </div>
          )}
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => { reset(); onOpenChange(false); }} disabled={isBusy}>
            Cancel
          </Button>
          <Button onClick={handleSubmit} disabled={isBusy || files.length === 0} className="gap-1.5">
            <Upload className="h-3.5 w-3.5" />
            {isBusy
              ? `Uploading ${progress!.done + 1} of ${progress!.total}…`
              : files.length > 1
              ? `Upload ${files.length} files`
              : "Upload"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function MoveToFolderDialog({
  open,
  onOpenChange,
  count,
  existingFolders,
  isBusy,
  onMove,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  count: number;
  existingFolders: string[];
  isBusy: boolean;
  onMove: (folder: string) => Promise<void>;
}) {
  const [folder, setFolder] = useState("");
  const [newFolderName, setNewFolderName] = useState("");
  const [mode, setMode] = useState<"existing" | "new">(existingFolders.length > 0 ? "existing" : "new");

  const target = mode === "new" ? newFolderName.trim() : folder;

  function reset() {
    setFolder("");
    setNewFolderName("");
    setMode(existingFolders.length > 0 ? "existing" : "new");
  }

  async function handleMove() {
    await onMove(target);
    reset();
  }

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!v) reset(); onOpenChange(v); }}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Move {count} document{count !== 1 ? "s" : ""} to folder</DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => setMode("existing")}
              className={`flex-1 rounded-md border px-3 py-1.5 text-xs font-medium transition-colors ${mode === "existing" ? "border-primary bg-primary/10 text-primary" : "border-border text-muted-foreground hover:border-primary"}`}
            >
              Existing folder
            </button>
            <button
              type="button"
              onClick={() => setMode("new")}
              className={`flex-1 rounded-md border px-3 py-1.5 text-xs font-medium transition-colors ${mode === "new" ? "border-primary bg-primary/10 text-primary" : "border-border text-muted-foreground hover:border-primary"}`}
            >
              New folder
            </button>
          </div>
          {mode === "existing" ? (
            existingFolders.length > 0 ? (
              <Select value={folder} onValueChange={setFolder}>
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="Choose a folder…" />
                </SelectTrigger>
                <SelectContent>
                  {existingFolders.map((f) => (
                    <SelectItem key={f} value={f}>{f}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            ) : (
              <p className="text-xs text-muted-foreground">No folders yet — switch to New folder.</p>
            )
          ) : (
            <Input
              placeholder="New folder name…"
              value={newFolderName}
              onChange={(e) => setNewFolderName(e.target.value)}
              autoFocus
            />
          )}
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => { reset(); onOpenChange(false); }} disabled={isBusy}>
            Cancel
          </Button>
          <Button
            onClick={handleMove}
            disabled={isBusy || !target}
            className="gap-1.5"
          >
            <FolderInput className="h-3.5 w-3.5" />
            {isBusy ? "Moving…" : `Move ${count} document${count !== 1 ? "s" : ""}`}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
