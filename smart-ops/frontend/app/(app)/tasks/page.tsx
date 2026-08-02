"use client";

import { useMemo, useState } from "react";
import {
  DndContext,
  DragOverlay,
  PointerSensor,
  KeyboardSensor,
  closestCorners,
  useSensor,
  useSensors,
  type DragEndEvent,
  type DragStartEvent,
} from "@dnd-kit/core";
import { useDroppable } from "@dnd-kit/core";
import {
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { ListChecks, LayoutGrid, TableIcon, Plus, CalendarClock, User as UserIcon, Send } from "lucide-react";
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
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";
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
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { useProjects } from "@/lib/hooks/use-projects";
import {
  useCreateTask,
  useHkComments,
  usePostHkComment,
  usePostTaskUpdate,
  useTaskUpdates,
  useTasks,
  useUpdateTask,
} from "@/lib/hooks/use-tasks";
import { useUsers } from "@/lib/hooks/use-users";
import { useCurrentUser } from "@/lib/hooks/use-auth";
import type { Task, TaskPriority } from "@/lib/types";

const HK_COMMENTER_EMAIL = "hkotecha@kwale-group.com";

type ViewMode = "board" | "table";

const PRIORITY_OPTIONS: TaskPriority[] = ["low", "medium", "high", "urgent"];
const FALLBACK_STATUSES = ["open", "in_progress", "done"];

export default function TasksPage() {
  const { data: projects } = useProjects();
  const [projectId, setProjectId] = useState<string>("");
  const { data, isLoading, isError, refetch } = useTasks(projectId || undefined);
  const [view, setView] = useState<ViewMode>("board");
  const [createOpen, setCreateOpen] = useState(false);
  const updateTask = useUpdateTask();
  const [activeTask, setActiveTask] = useState<Task | null>(null);
  const [detailTask, setDetailTask] = useState<Task | null>(null);

  const tasks = useMemo(() => data ?? [], [data]);

  const statuses = useMemo(() => {
    // Always show the standard columns (so a task can be dragged into a
    // status — e.g. "done" — that no task currently has) plus any other
    // custom status values already present on existing tasks.
    const set = new Set<string>(FALLBACK_STATUSES);
    tasks.forEach((t) => t.status && set.add(t.status));
    return Array.from(set);
  }, [tasks]);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  function handleDragStart(event: DragStartEvent) {
    const task = tasks.find((t) => t.id === String(event.active.id));
    setActiveTask(task ?? null);
  }

  function handleDragEnd(event: DragEndEvent) {
    setActiveTask(null);
    const { active, over } = event;
    if (!over) return;
    const taskId = String(active.id);
    const targetStatus = String(over.data.current?.status ?? over.id);
    const task = tasks.find((t) => t.id === taskId);
    if (!task || task.status === targetStatus) return;
    updateTask.mutate(
      { id: taskId, payload: { status: targetStatus } },
      { onError: () => toast.error("Failed to move task") },
    );
  }

  return (
    <div>
      <PageHeader
        title="Tasks"
        description="Track and coordinate cross-organization work."
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
            <div className="flex items-center rounded-md border border-border p-0.5">
              <Button
                variant={view === "board" ? "secondary" : "ghost"}
                size="icon-sm"
                aria-label="Board view"
                onClick={() => setView("board")}
              >
                <LayoutGrid className="h-4 w-4" />
              </Button>
              <Button
                variant={view === "table" ? "secondary" : "ghost"}
                size="icon-sm"
                aria-label="Table view"
                onClick={() => setView("table")}
              >
                <TableIcon className="h-4 w-4" />
              </Button>
            </div>
            <CreateTaskDialog
              open={createOpen}
              onOpenChange={setCreateOpen}
              defaultProjectId={projectId}
            />
          </div>
        }
      />

      {isLoading ? (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
          {Array.from({ length: 3 }).map((_, i) => (
            <Skeleton key={i} className="h-64 rounded-xl" />
          ))}
        </div>
      ) : isError ? (
        <ErrorState onRetry={() => refetch()} />
      ) : tasks.length === 0 ? (
        <EmptyState
          icon={ListChecks}
          title="No tasks found"
          description="Create a task to start tracking work."
          action={
            <Button size="sm" onClick={() => setCreateOpen(true)} className="gap-1.5">
              <Plus className="h-3.5 w-3.5" />
              New task
            </Button>
          }
        />
      ) : view === "board" ? (
        <DndContext
          sensors={sensors}
          collisionDetection={closestCorners}
          onDragStart={handleDragStart}
          onDragEnd={handleDragEnd}
        >
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {statuses.map((status) => (
              <TaskColumn
                key={status}
                status={status}
                tasks={tasks.filter((t) => (t.status ?? statuses[0]) === status)}
                onOpen={setDetailTask}
              />
            ))}
          </div>
          <DragOverlay>{activeTask ? <TaskCard task={activeTask} /> : null}</DragOverlay>
        </DndContext>
      ) : (
        <div className="overflow-hidden rounded-xl border border-border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Title</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Priority</TableHead>
                <TableHead>Responsible</TableHead>
                <TableHead>Due Date</TableHead>
                <TableHead>Progress</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {tasks.map((task) => (
                <TableRow
                  key={task.id}
                  className="cursor-pointer"
                  onClick={() => setDetailTask(task)}
                >
                  <TableCell className="font-medium text-foreground">{task.title}</TableCell>
                  <TableCell>{task.status ? <StatusPill status={task.status} /> : "—"}</TableCell>
                  <TableCell>
                    {task.priority ? <StatusPill status={task.priority} /> : "—"}
                  </TableCell>
                  <TableCell>{task.owner_name || "Unassigned"}</TableCell>
                  <TableCell>{task.due_date || "—"}</TableCell>
                  <TableCell>
                    {typeof task.progress_percent === "number"
                      ? `${task.progress_percent}%`
                      : "—"}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}

      <TaskDetailSheet task={detailTask} onOpenChange={(open) => !open && setDetailTask(null)} />
    </div>
  );
}

function TaskColumn({
  status,
  tasks,
  onOpen,
}: {
  status: string;
  tasks: Task[];
  onOpen: (task: Task) => void;
}) {
  const { setNodeRef, isOver } = useDroppable({ id: status, data: { status } });
  return (
    <div
      ref={setNodeRef}
      className={cn(
        "flex flex-col gap-3 rounded-xl border border-border bg-muted/30 p-3",
        isOver && "ring-2 ring-primary/50",
      )}
    >
      <div className="flex items-center justify-between px-1">
        <StatusPill status={status} />
        <span className="text-xs text-muted-foreground">{tasks.length}</span>
      </div>
      <SortableContext items={tasks.map((t) => t.id)} strategy={verticalListSortingStrategy}>
        <div className="flex flex-col gap-2">
          {tasks.map((task) => (
            <SortableTaskCard key={task.id} task={task} onOpen={onOpen} />
          ))}
          {tasks.length === 0 ? (
            <p className="rounded-lg border border-dashed border-border py-6 text-center text-xs text-muted-foreground">
              No tasks
            </p>
          ) : null}
        </div>
      </SortableContext>
    </div>
  );
}

function SortableTaskCard({ task, onOpen }: { task: Task; onOpen: (task: Task) => void }) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: task.id,
    data: { status: task.status },
  });
  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  };
  return (
    <div
      ref={setNodeRef}
      style={style}
      {...attributes}
      {...listeners}
      className={cn("touch-none", isDragging && "opacity-50")}
      onClick={() => onOpen(task)}
    >
      <TaskCard task={task} />
    </div>
  );
}

function TaskCard({ task }: { task: Task }) {
  return (
    <Card className="glass-panel cursor-grab shadow-sm active:cursor-grabbing">
      <CardContent className="space-y-2">
        <p className="text-sm font-medium text-foreground">{task.title}</p>
        {task.description ? (
          <p className="line-clamp-2 text-xs text-muted-foreground">{task.description}</p>
        ) : null}
        <div className="flex items-center justify-between text-xs text-muted-foreground">
          {task.priority ? <StatusPill status={task.priority} /> : <span />}
          {task.due_date ? (
            <span className="flex items-center gap-1">
              <CalendarClock className="h-3 w-3" />
              {task.due_date}
            </span>
          ) : null}
        </div>
        <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
          <UserIcon className="h-3 w-3" />
          {task.owner_name || "Unassigned"}
        </div>
      </CardContent>
    </Card>
  );
}

function TaskDetailSheet({
  task,
  onOpenChange,
}: {
  task: Task | null;
  onOpenChange: (open: boolean) => void;
}) {
  const { data: updates, isLoading } = useTaskUpdates(task?.id ?? "");
  const postUpdate = usePostTaskUpdate();
  const [message, setMessage] = useState("");

  const { data: currentUser } = useCurrentUser();
  const { data: hkComments, isLoading: hkCommentsLoading } = useHkComments(task?.id ?? "");
  const postHkComment = usePostHkComment();
  const [hkMessage, setHkMessage] = useState("");
  const canPostHkComment = currentUser?.email === HK_COMMENTER_EMAIL;

  function handlePost() {
    if (!task || !message.trim()) return;
    postUpdate.mutate(
      { taskId: task.id, description: message.trim() },
      {
        onSuccess: () => setMessage(""),
        onError: () => toast.error("Failed to post update"),
      },
    );
  }

  function handlePostHkComment() {
    if (!task || !hkMessage.trim()) return;
    postHkComment.mutate(
      { taskId: task.id, description: hkMessage.trim() },
      {
        onSuccess: () => setHkMessage(""),
        onError: () => toast.error("Failed to post HK comment"),
      },
    );
  }

  return (
    <Sheet open={Boolean(task)} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="w-full sm:max-w-md">
        {task ? (
          <div className="flex h-full flex-col">
            <SheetHeader>
              <SheetTitle>{task.title}</SheetTitle>
              <SheetDescription>
                Responsible: {task.owner_name || "Unassigned"}
                {task.due_date ? ` · Due ${task.due_date}` : ""}
              </SheetDescription>
            </SheetHeader>

            <div className="flex flex-1 flex-col gap-4 overflow-y-auto px-4 pb-4">
              <div className="flex items-center gap-2">
                {task.status ? <StatusPill status={task.status} /> : null}
                {task.priority ? <StatusPill status={task.priority} /> : null}
              </div>
              {task.description ? (
                <p className="text-sm text-muted-foreground">{task.description}</p>
              ) : null}

              <div className="space-y-2">
                <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                  HK Comment
                </p>
                {hkCommentsLoading ? (
                  <Skeleton className="h-16 rounded-lg" />
                ) : hkComments && hkComments.length > 0 ? (
                  <div className="space-y-2">
                    {hkComments.map((c) => (
                      <div key={c.id} className="rounded-lg border border-border p-2.5 text-sm">
                        <div className="mb-1 flex items-center justify-between text-xs text-muted-foreground">
                          <span className="font-medium text-foreground">
                            {c.user_name || "Unknown"}
                          </span>
                          <span>{c.created_at ? new Date(c.created_at).toLocaleString() : ""}</span>
                        </div>
                        <p>{c.description}</p>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-sm text-muted-foreground">No HK comments yet.</p>
                )}
                {canPostHkComment && (
                  <div className="flex items-center gap-2 pt-1">
                    <Textarea
                      placeholder="Post an HK comment…"
                      value={hkMessage}
                      onChange={(e) => setHkMessage(e.target.value)}
                      className="min-h-9 resize-none"
                      rows={1}
                    />
                    <Button
                      size="icon-sm"
                      onClick={handlePostHkComment}
                      disabled={postHkComment.isPending || !hkMessage.trim()}
                      aria-label="Post HK comment"
                    >
                      <Send className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                )}
              </div>

              <div className="space-y-2">
                <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                  Updates
                </p>
                {isLoading ? (
                  <Skeleton className="h-16 rounded-lg" />
                ) : updates && updates.length > 0 ? (
                  <div className="space-y-2">
                    {updates.map((u) => (
                      <div key={u.id} className="rounded-lg border border-border p-2.5 text-sm">
                        <div className="mb-1 flex items-center justify-between text-xs text-muted-foreground">
                          <span className="font-medium text-foreground">
                            {u.user_name || "Unknown"}
                          </span>
                          <span>{u.created_at ? new Date(u.created_at).toLocaleString() : ""}</span>
                        </div>
                        <p>{u.description}</p>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-sm text-muted-foreground">No updates yet.</p>
                )}
              </div>
            </div>

            <div className="flex items-center gap-2 border-t border-border p-4">
              <Textarea
                placeholder="Post an update…"
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                className="min-h-9 resize-none"
                rows={1}
              />
              <Button
                size="icon-sm"
                onClick={handlePost}
                disabled={postUpdate.isPending || !message.trim()}
                aria-label="Post update"
              >
                <Send className="h-3.5 w-3.5" />
              </Button>
            </div>
          </div>
        ) : null}
      </SheetContent>
    </Sheet>
  );
}

function CreateTaskDialog({
  open,
  onOpenChange,
  defaultProjectId,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  defaultProjectId?: string;
}) {
  const { data: projects } = useProjects();
  const { data: users } = useUsers();
  const createTask = useCreateTask();
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [priority, setPriority] = useState<TaskPriority>("medium");
  const [dueDate, setDueDate] = useState("");
  const [projectId, setProjectId] = useState(defaultProjectId || "");
  const [ownerId, setOwnerId] = useState("");

  function reset() {
    setTitle("");
    setDescription("");
    setPriority("medium");
    setDueDate("");
    setOwnerId("");
  }

  function handleSubmit() {
    if (!title.trim() || !projectId) {
      toast.error("Title and project are required");
      return;
    }
    createTask.mutate(
      {
        title,
        description,
        priority,
        due_date: dueDate || undefined,
        project_id: projectId,
        owner_user_id: ownerId || undefined,
        status: "open",
      },
      {
        onSuccess: () => {
          toast.success("Task created");
          reset();
          onOpenChange(false);
        },
        onError: () => toast.error("Failed to create task"),
      },
    );
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogTrigger asChild>
        <Button size="sm" className="gap-1.5">
          <Plus className="h-3.5 w-3.5" />
          New task
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>New task</DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          <div className="space-y-1.5">
            <Label htmlFor="task-project">Project</Label>
            <Select value={projectId} onValueChange={setProjectId}>
              <SelectTrigger id="task-project" className="w-full">
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
            <Label htmlFor="task-title">Title</Label>
            <Input id="task-title" value={title} onChange={(e) => setTitle(e.target.value)} />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="task-description">Description</Label>
            <Textarea
              id="task-description"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="task-priority">Priority</Label>
              <Select value={priority} onValueChange={(v) => setPriority(v as TaskPriority)}>
                <SelectTrigger id="task-priority" className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {PRIORITY_OPTIONS.map((p) => (
                    <SelectItem key={p} value={p}>
                      {p}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="task-due-date">Due date</Label>
              <Input
                id="task-due-date"
                type="date"
                value={dueDate}
                onChange={(e) => setDueDate(e.target.value)}
              />
            </div>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="task-owner">Responsible</Label>
            <Select value={ownerId || "unassigned"} onValueChange={(v) => setOwnerId(v === "unassigned" ? "" : v)}>
              <SelectTrigger id="task-owner" className="w-full">
                <SelectValue placeholder="Unassigned" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="unassigned">Unassigned</SelectItem>
                {(users ?? []).map((u) => (
                  <SelectItem key={u.id} value={u.id}>
                    {u.full_name || u.email}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>
        <DialogFooter>
          <Button onClick={handleSubmit} disabled={createTask.isPending}>
            Create
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
