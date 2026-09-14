"use client";

import { useMemo, useRef, useState } from "react";
import { ArrowLeft, FileText, Folder, FolderPlus, Plus, Trash2, Upload } from "lucide-react";
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

  // Folder navigation state
  const [currentFolder, setCurrentFolder] = useState<string | null>(null);
  // Locally created empty folders (disappear on refresh if no docs added)
  const [localFolders, setLocalFolders] = useState<string[]>([]);

  // Dialog state
  const [newFolderOpen, setNewFolderOpen] = useState(false);
  const [uploadOpen, setUploadOpen] = useState(false);
  const [detail, setDetail] = useState<DocumentRecord | null>(null);

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
                <DocumentGrid docs={visibleDocs} onOpen={setDetail} />
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
                <DocumentGrid docs={visibleDocs} onOpen={setDetail} />
              )}
            </div>
          )}
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
    </div>
  );
}

function DocumentGrid({
  docs,
  onOpen,
}: {
  docs: DocumentRecord[];
  onOpen: (doc: DocumentRecord) => void;
}) {
  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
      {docs.map((doc) => (
        <Card
          key={doc.id}
          className="glass-panel cursor-pointer transition-shadow hover:shadow-md"
          onClick={() => onOpen(doc)}
        >
          <CardContent className="space-y-2">
            <div className="flex items-start gap-2">
              <FileText className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" />
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
      ))}
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

  const [name, setName] = useState("");
  const [folder, setFolder] = useState(defaultFolder);
  const [newFolderName, setNewFolderName] = useState("");
  const [folderMode, setFolderMode] = useState<"existing" | "new">(
    defaultFolder ? "existing" : existingFolders.length > 0 ? "existing" : "new",
  );
  const [file, setFile] = useState<File | null>(null);
  const [projectId, setProjectId] = useState(defaultProjectId || "");
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Sync defaults when dialog opens
  const effectiveFolder =
    folderMode === "new" ? newFolderName.trim() : folder;

  function reset() {
    setName("");
    setFolder(defaultFolder);
    setNewFolderName("");
    setFolderMode(defaultFolder ? "existing" : existingFolders.length > 0 ? "existing" : "new");
    setFile(null);
    if (fileInputRef.current) fileInputRef.current.value = "";
  }

  async function handleSubmit() {
    if (!name.trim()) {
      toast.error("Document name is required");
      return;
    }
    if (!projectId) {
      toast.error("Please select a project");
      return;
    }
    if (!file) {
      toast.error("Please choose a file to upload");
      return;
    }

    createDocument.mutate(
      { name: name.trim(), folder: effectiveFolder || undefined, status: "draft", project_id: projectId },
      {
        onSuccess: async (doc) => {
          try {
            await uploadFile.mutateAsync({ id: doc.id, file });
            toast.success("Document uploaded");
          } catch {
            toast.error("Document created but file upload failed");
          }
          reset();
          onOpenChange(false);
        },
        onError: () => toast.error("Failed to create document"),
      },
    );
  }

  const isBusy = createDocument.isPending || uploadFile.isPending;

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!v) reset(); onOpenChange(v); }}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Upload Document</DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          {/* File picker — prominent at top */}
          <div className="space-y-1.5">
            <Label>File</Label>
            <input
              ref={fileInputRef}
              type="file"
              className="hidden"
              onChange={(e) => {
                const f = e.target.files?.[0] ?? null;
                setFile(f);
                if (f && !name.trim()) {
                  // Auto-fill name from filename (strip extension)
                  setName(f.name.replace(/\.[^.]+$/, ""));
                }
              }}
            />
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              className="flex w-full items-center gap-2 rounded-md border border-dashed border-input bg-background px-3 py-3 text-sm text-muted-foreground hover:border-primary hover:text-foreground transition-colors"
            >
              <Upload className="h-4 w-4 shrink-0" />
              {file ? (
                <span className="truncate text-foreground font-medium">{file.name}</span>
              ) : (
                <span>Choose a file from your computer…</span>
              )}
            </button>
            {file && (
              <p className="text-xs text-muted-foreground">
                {(file.size / 1024).toFixed(0)} KB · {file.type || "unknown type"}
              </p>
            )}
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="up-name">Document name</Label>
            <Input
              id="up-name"
              placeholder="Name this document…"
              value={name}
              onChange={(e) => setName(e.target.value)}
            />
          </div>

          {/* Folder: pick existing or type new */}
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
                      <SelectItem key={f} value={f}>
                        {f}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              ) : (
                <p className="text-xs text-muted-foreground">No folders yet — create one above.</p>
              )
            ) : (
              <Input
                placeholder="New folder name…"
                value={newFolderName}
                onChange={(e) => setNewFolderName(e.target.value)}
              />
            )}
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="up-project">Project</Label>
            <Select value={projectId} onValueChange={setProjectId}>
              <SelectTrigger id="up-project" className="w-full">
                <SelectValue placeholder="Select project" />
              </SelectTrigger>
              <SelectContent>
                {(projects ?? []).map((p) => (
                  <SelectItem key={p.id} value={p.id}>
                    {p.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => { reset(); onOpenChange(false); }} disabled={isBusy}>
            Cancel
          </Button>
          <Button onClick={handleSubmit} disabled={isBusy} className="gap-1.5">
            <Upload className="h-3.5 w-3.5" />
            {isBusy ? (uploadFile.isPending ? "Uploading…" : "Creating…") : "Upload"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
