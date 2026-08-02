"use client";

import { useMemo, useState } from "react";
import { FileText, Folder, Plus, Trash2 } from "lucide-react";
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
  DialogTrigger,
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
} from "@/lib/hooks/use-documents";
import type { DocumentRecord, DocumentStatus } from "@/lib/types";
import { formatTimestamp } from "@/components/ui-custom/activity-row";

const STATUS_OPTIONS: DocumentStatus[] = ["draft", "in_review", "approved"];

export default function DocumentsPage() {
  const { data: projects } = useProjects();
  const [projectId, setProjectId] = useState<string>("");
  const { data, isLoading, isError, refetch } = useDocuments(projectId || undefined);
  const [createOpen, setCreateOpen] = useState(false);
  const [detail, setDetail] = useState<DocumentRecord | null>(null);
  const deleteDocument = useDeleteDocument();

  const documents = useMemo(() => data ?? [], [data]);

  const grouped = useMemo(() => {
    const groups = new Map<string, DocumentRecord[]>();
    for (const doc of documents) {
      const folder = doc.folder || "Uncategorized";
      if (!groups.has(folder)) groups.set(folder, []);
      groups.get(folder)!.push(doc);
    }
    return Array.from(groups.entries());
  }, [documents]);

  function handleDelete(id: string) {
    deleteDocument.mutate(id, {
      onSuccess: () => {
        toast.success("Document deleted");
        setDetail(null);
      },
      onError: () => toast.error("Failed to delete document"),
    });
  }

  return (
    <div>
      <PageHeader
        title="Documents"
        description="Centralized document repository shared across both organizations."
        actions={
          <div className="flex items-center gap-2">
            <Select value={projectId || "all"} onValueChange={(v) => setProjectId(v === "all" ? "" : v)}>
              <SelectTrigger className="w-48">
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
            <CreateDocumentDialog
              open={createOpen}
              onOpenChange={setCreateOpen}
              defaultProjectId={projectId}
            />
          </div>
        }
      />

      {isLoading ? (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 6 }).map((_, i) => (
            <Skeleton key={i} className="h-28 rounded-xl" />
          ))}
        </div>
      ) : isError ? (
        <ErrorState onRetry={() => refetch()} />
      ) : documents.length === 0 ? (
        <EmptyState
          icon={FileText}
          title="No documents yet"
          description="Upload a document to get started."
          action={
            <Button size="sm" onClick={() => setCreateOpen(true)} className="gap-1.5">
              <Plus className="h-3.5 w-3.5" />
              New document
            </Button>
          }
        />
      ) : (
        <div className="space-y-6">
          {grouped.map(([folder, docs]) => (
            <div key={folder}>
              <div className="mb-2 flex items-center gap-2 text-sm font-medium text-foreground">
                <Folder className="h-4 w-4 text-primary" />
                {folder}
              </div>
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
                {docs.map((doc) => (
                  <Card
                    key={doc.id}
                    className="glass-panel cursor-pointer transition-shadow hover:shadow-md"
                    onClick={() => setDetail(doc)}
                  >
                    <CardContent className="space-y-2">
                      <div className="flex items-start justify-between gap-2">
                        <p className="line-clamp-1 text-sm font-semibold text-foreground">
                          {doc.name}
                        </p>
                        {doc.status ? <StatusPill status={doc.status} /> : null}
                      </div>
                      <div className="flex items-center justify-between text-xs text-muted-foreground">
                        <span>v{doc.version ?? 1}</span>
                        <span>{formatTimestamp(doc.created_at)}</span>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}

      <Sheet open={Boolean(detail)} onOpenChange={(open) => !open && setDetail(null)}>
        <SheetContent side="right" className="w-full sm:max-w-md">
          {detail ? (
            <>
              <SheetHeader>
                <SheetTitle>{detail.name}</SheetTitle>
                <SheetDescription>Folder: {detail.folder || "Uncategorized"}</SheetDescription>
              </SheetHeader>
              <div className="space-y-4 px-4 pb-4">
                <div className="flex items-center justify-between text-sm">
                  <span className="text-muted-foreground">Status</span>
                  {detail.status ? <StatusPill status={detail.status} /> : "—"}
                </div>
                <div className="flex items-center justify-between text-sm">
                  <span className="text-muted-foreground">Version</span>
                  <span>{detail.version ?? 1}</span>
                </div>
                <div className="flex items-center justify-between text-sm">
                  <span className="text-muted-foreground">Created</span>
                  <span>{formatTimestamp(detail.created_at)}</span>
                </div>
                {detail.file_url ? (
                  <Button variant="outline" size="sm" asChild className="w-full">
                    <a href={detail.file_url} target="_blank" rel="noreferrer">
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
    </div>
  );
}

function CreateDocumentDialog({
  open,
  onOpenChange,
  defaultProjectId,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  defaultProjectId?: string;
}) {
  const { data: projects } = useProjects();
  const createDocument = useCreateDocument();
  const [name, setName] = useState("");
  const [folder, setFolder] = useState("");
  const [fileUrl, setFileUrl] = useState("");
  const [status, setStatus] = useState<DocumentStatus>("draft");
  const [projectId, setProjectId] = useState(defaultProjectId || "");

  function reset() {
    setName("");
    setFolder("");
    setFileUrl("");
    setStatus("draft");
  }

  function handleSubmit() {
    if (!name.trim() || !projectId) {
      toast.error("Name and project are required");
      return;
    }
    createDocument.mutate(
      { name, folder, file_url: fileUrl, status, project_id: projectId },
      {
        onSuccess: () => {
          toast.success("Document created");
          reset();
          onOpenChange(false);
        },
        onError: () => toast.error("Failed to create document"),
      },
    );
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogTrigger asChild>
        <Button size="sm" className="gap-1.5">
          <Plus className="h-3.5 w-3.5" />
          New document
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>New document</DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          <div className="space-y-1.5">
            <Label htmlFor="doc-project">Project</Label>
            <Select value={projectId} onValueChange={setProjectId}>
              <SelectTrigger id="doc-project" className="w-full">
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
          <div className="space-y-1.5">
            <Label htmlFor="doc-name">Name</Label>
            <Input id="doc-name" value={name} onChange={(e) => setName(e.target.value)} />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="doc-folder">Folder</Label>
            <Input id="doc-folder" value={folder} onChange={(e) => setFolder(e.target.value)} />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="doc-file-url">File URL</Label>
            <Input
              id="doc-file-url"
              placeholder="https://…"
              value={fileUrl}
              onChange={(e) => setFileUrl(e.target.value)}
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="doc-status">Status</Label>
            <Select value={status} onValueChange={(v) => setStatus(v as DocumentStatus)}>
              <SelectTrigger id="doc-status" className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {STATUS_OPTIONS.map((s) => (
                  <SelectItem key={s} value={s}>
                    {s.replace(/_/g, " ")}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>
        <DialogFooter>
          <Button onClick={handleSubmit} disabled={createDocument.isPending}>
            Create
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
