"use client";

import { useMemo, useState } from "react";
import { Ruler, Plus, Send, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { PageHeader } from "@/components/ui-custom/page-header";
import { EmptyState } from "@/components/ui-custom/empty-state";
import { ErrorState } from "@/components/ui-custom/error-state";
import { StatusPill } from "@/components/ui-custom/status-pill";
import { ConfirmDeleteDialog } from "@/components/ui-custom/confirm-delete-dialog";
import { formatTimestamp } from "@/components/ui-custom/activity-row";
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
  useCreateDrawing,
  useCreateDrawingComment,
  useDeleteDrawing,
  useDrawing,
  useDrawings,
  useUpdateDrawing,
} from "@/lib/hooks/use-engineering";
import type { Drawing, DrawingStatus } from "@/lib/types";

const STATUS_OPTIONS: DrawingStatus[] = ["draft", "in_review", "approved"];

export default function EngineeringPage() {
  const { data: projects } = useProjects();
  const [projectId, setProjectId] = useState<string>("");
  const { data, isLoading, isError, refetch } = useDrawings(projectId || undefined);
  const [createOpen, setCreateOpen] = useState(false);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [pendingDelete, setPendingDelete] = useState<Drawing | null>(null);
  const deleteDrawing = useDeleteDrawing();

  const drawings = useMemo(() => data ?? [], [data]);

  function handleDelete() {
    if (!pendingDelete) return;
    deleteDrawing.mutate(pendingDelete.id, {
      onSuccess: () => {
        toast.success("Drawing deleted");
        setPendingDelete(null);
      },
      onError: () => toast.error("Failed to delete drawing"),
    });
  }

  return (
    <div>
      <PageHeader
        title="Engineering"
        description="Manage technical drawings, specifications, and design reviews."
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
            <CreateDrawingDialog
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
      ) : drawings.length === 0 ? (
        <EmptyState
          icon={Ruler}
          title="No drawings yet"
          description="Add a technical drawing to start a design review."
          action={
            <Button size="sm" onClick={() => setCreateOpen(true)} className="gap-1.5">
              <Plus className="h-3.5 w-3.5" />
              New drawing
            </Button>
          }
        />
      ) : (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {drawings.map((drawing) => (
            <Card
              key={drawing.id}
              className="glass-panel cursor-pointer transition-shadow hover:shadow-md"
              onClick={() => setSelectedId(drawing.id)}
            >
              <CardContent className="space-y-2">
                <div className="flex items-start justify-between gap-2">
                  <p className="line-clamp-1 text-sm font-semibold text-foreground">
                    {drawing.title}
                  </p>
                  <div className="flex shrink-0 items-center gap-1">
                    {drawing.status ? <StatusPill status={drawing.status} /> : null}
                    <Button
                      size="icon-sm"
                      variant="ghost"
                      aria-label="Delete drawing"
                      onClick={(e) => {
                        e.stopPropagation();
                        setPendingDelete(drawing);
                      }}
                    >
                      <Trash2 className="h-3.5 w-3.5 text-destructive" />
                    </Button>
                  </div>
                </div>
                <div className="flex items-center justify-between text-xs text-muted-foreground">
                  <span>{drawing.discipline || "—"}</span>
                  <span>v{drawing.version ?? 1}</span>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      <DrawingDetailSheet id={selectedId} onClose={() => setSelectedId(null)} />
      <ConfirmDeleteDialog
        open={Boolean(pendingDelete)}
        onOpenChange={(open) => !open && setPendingDelete(null)}
        title="Delete this drawing?"
        description="This can't be undone."
        isPending={deleteDrawing.isPending}
        onConfirm={handleDelete}
      />
    </div>
  );
}

function DrawingDetailSheet({ id, onClose }: { id: string | null; onClose: () => void }) {
  const { data: drawing, isLoading, isError, refetch } = useDrawing(id ?? "");
  const createComment = useCreateDrawingComment(id ?? "");
  const updateDrawing = useUpdateDrawing();
  const [commentText, setCommentText] = useState("");

  function handleStatusChange(status: string) {
    if (!id) return;
    updateDrawing.mutate(
      { id, payload: { status } },
      { onError: () => toast.error("Failed to update status") },
    );
  }

  function handleAddComment() {
    if (!commentText.trim() || !id) return;
    createComment.mutate(
      { body: commentText },
      {
        onSuccess: () => setCommentText(""),
        onError: () => toast.error("Failed to add comment"),
      },
    );
  }

  return (
    <Sheet open={Boolean(id)} onOpenChange={(open) => !open && onClose()}>
      <SheetContent side="right" className="w-full sm:max-w-lg">
        {isLoading ? (
          <div className="space-y-3 px-4">
            <Skeleton className="h-6 w-2/3" />
            <Skeleton className="h-24 w-full" />
          </div>
        ) : isError ? (
          <div className="px-4">
            <ErrorState onRetry={() => refetch()} />
          </div>
        ) : drawing ? (
          <>
            <SheetHeader>
              <SheetTitle>{drawing.title}</SheetTitle>
              <SheetDescription>
                {drawing.discipline || "General"} · v{drawing.version ?? 1}
              </SheetDescription>
            </SheetHeader>
            <div className="space-y-4 px-4 pb-4">
              <div className="flex items-center justify-between text-sm">
                <span className="text-muted-foreground">Status</span>
                <Select
                  value={drawing.status || "draft"}
                  onValueChange={handleStatusChange}
                  disabled={updateDrawing.isPending}
                >
                  <SelectTrigger className="w-40">
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
              {drawing.file_url ? (
                <Button variant="outline" size="sm" asChild className="w-full">
                  <a href={drawing.file_url} target="_blank" rel="noreferrer">
                    Open drawing file
                  </a>
                </Button>
              ) : null}

              <div>
                <p className="mb-2 text-xs font-semibold uppercase text-muted-foreground">
                  Comments
                </p>
                <div className="space-y-3">
                  {(drawing.comments ?? []).length === 0 ? (
                    <p className="text-xs text-muted-foreground">No comments yet.</p>
                  ) : (
                    (drawing.comments ?? []).map((comment) => (
                      <div key={comment.id} className="rounded-md border border-border p-2">
                        <p className="text-sm text-foreground">{comment.body}</p>
                        <p className="mt-1 text-[10px] text-muted-foreground">
                          {comment.user_name || "Member"} · {formatTimestamp(comment.created_at)}
                        </p>
                      </div>
                    ))
                  )}
                </div>
                <div className="mt-3 flex items-center gap-2">
                  <Input
                    placeholder="Add a comment…"
                    value={commentText}
                    onChange={(e) => setCommentText(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") handleAddComment();
                    }}
                  />
                  <Button
                    size="icon"
                    aria-label="Add comment"
                    onClick={handleAddComment}
                    disabled={createComment.isPending || !commentText.trim()}
                  >
                    <Send className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            </div>
          </>
        ) : null}
      </SheetContent>
    </Sheet>
  );
}

function CreateDrawingDialog({
  open,
  onOpenChange,
  defaultProjectId,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  defaultProjectId?: string;
}) {
  const { data: projects } = useProjects();
  const createDrawing = useCreateDrawing();
  const [title, setTitle] = useState("");
  const [discipline, setDiscipline] = useState("");
  const [fileUrl, setFileUrl] = useState("");
  const [status, setStatus] = useState<DrawingStatus>("draft");
  const [projectId, setProjectId] = useState(defaultProjectId || "");

  function reset() {
    setTitle("");
    setDiscipline("");
    setFileUrl("");
    setStatus("draft");
  }

  function handleSubmit() {
    if (!title.trim() || !projectId) {
      toast.error("Title and project are required");
      return;
    }
    createDrawing.mutate(
      { title, discipline, file_url: fileUrl, status, project_id: projectId },
      {
        onSuccess: () => {
          toast.success("Drawing created");
          reset();
          onOpenChange(false);
        },
        onError: () => toast.error("Failed to create drawing"),
      },
    );
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogTrigger asChild>
        <Button size="sm" className="gap-1.5">
          <Plus className="h-3.5 w-3.5" />
          New drawing
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>New drawing</DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          <div className="space-y-1.5">
            <Label htmlFor="drawing-project">Project</Label>
            <Select value={projectId} onValueChange={setProjectId}>
              <SelectTrigger id="drawing-project" className="w-full">
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
            <Label htmlFor="drawing-title">Title</Label>
            <Input id="drawing-title" value={title} onChange={(e) => setTitle(e.target.value)} />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="drawing-discipline">Discipline</Label>
            <Input
              id="drawing-discipline"
              placeholder="Structural, Mechanical, …"
              value={discipline}
              onChange={(e) => setDiscipline(e.target.value)}
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="drawing-file-url">File URL</Label>
            <Input
              id="drawing-file-url"
              placeholder="https://…"
              value={fileUrl}
              onChange={(e) => setFileUrl(e.target.value)}
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="drawing-status">Status</Label>
            <Select value={status} onValueChange={(v) => setStatus(v as DrawingStatus)}>
              <SelectTrigger id="drawing-status" className="w-full">
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
          <Button onClick={handleSubmit} disabled={createDrawing.isPending}>
            Create
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
