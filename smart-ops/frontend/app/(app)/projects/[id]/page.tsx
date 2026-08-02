"use client";

import { use, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import {
  FolderKanban,
  CalendarClock,
  Milestone as MilestoneIcon,
  Package,
  Wallet,
  Users2,
  Activity,
  ShieldAlert,
  Gavel,
  Pencil,
  Plus,
  Trash2,
} from "lucide-react";
import { toast } from "sonner";
import { PageHeader } from "@/components/ui-custom/page-header";
import { EmptyState } from "@/components/ui-custom/empty-state";
import { ErrorState } from "@/components/ui-custom/error-state";
import { StatusPill } from "@/components/ui-custom/status-pill";
import { ConfirmDeleteDialog } from "@/components/ui-custom/confirm-delete-dialog";
import { ActivityRow, formatTimestamp } from "@/components/ui-custom/activity-row";
import { Card, CardContent } from "@/components/ui/card";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
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
import { useDeleteProject, useProject, useUpdateProject } from "@/lib/hooks/use-projects";
import { ApiError } from "@/lib/api-client";
import {
  useCreateMilestone,
  useDeleteMilestone,
  useMilestones,
} from "@/lib/hooks/use-milestones";
import {
  useCreateDeliverable,
  useDeleteDeliverable,
  useDeliverables,
} from "@/lib/hooks/use-deliverables";
import { useCreateRisk, useDeleteRisk, useRisks } from "@/lib/hooks/use-risks";
import { useCreateDecision, useDeleteDecision, useDecisions } from "@/lib/hooks/use-decisions";
import {
  useCreateProjectParticipant,
  useDeleteProjectParticipant,
  useProjectParticipants,
} from "@/lib/hooks/use-project-participants";
import { useUsers } from "@/lib/hooks/use-users";
import { useOrganizations } from "@/lib/hooks/use-organizations";
import type {
  Decision,
  DecisionStatus,
  Deliverable,
  DeliverableStatus,
  Milestone,
  MilestoneStatus,
  Project,
  ProjectHealth,
  ProjectParticipant,
  ProjectStatus,
  Risk,
  RiskLikelihood,
  RiskSeverity,
  RiskStatus,
} from "@/lib/types";

const STATUS_OPTIONS: ProjectStatus[] = [
  "planning",
  "active",
  "on_hold",
  "completed",
  "cancelled",
];
const HEALTH_OPTIONS: ProjectHealth[] = ["on_track", "at_risk", "delayed"];
const MILESTONE_STATUS_OPTIONS: MilestoneStatus[] = [
  "pending",
  "in_progress",
  "completed",
  "delayed",
];
const DELIVERABLE_STATUS_OPTIONS: DeliverableStatus[] = [
  "pending",
  "in_progress",
  "completed",
  "delayed",
];
const RISK_SEVERITY_OPTIONS: RiskSeverity[] = ["low", "medium", "high", "critical"];
const RISK_LIKELIHOOD_OPTIONS: RiskLikelihood[] = ["low", "medium", "high"];
const RISK_STATUS_OPTIONS: RiskStatus[] = ["open", "mitigated", "closed"];
const DECISION_STATUS_OPTIONS: DecisionStatus[] = ["proposed", "approved", "rejected"];

export default function ProjectDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const router = useRouter();
  const { data: project, isLoading, isError, refetch } = useProject(id);
  const [editOpen, setEditOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const deleteProject = useDeleteProject();

  function handleDeleteProject() {
    deleteProject.mutate(id, {
      onSuccess: () => {
        toast.success("Project deleted");
        router.push("/projects");
      },
      onError: (error) =>
        toast.error(error instanceof ApiError ? error.message : "Failed to delete project"),
    });
  }

  if (isLoading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-24 w-full rounded-xl" />
        <Skeleton className="h-64 w-full rounded-xl" />
      </div>
    );
  }

  if (isError) {
    return <ErrorState onRetry={() => refetch()} />;
  }

  if (!project) {
    return <EmptyState icon={FolderKanban} title="Project not found" />;
  }

  return (
    <div>
      <PageHeader
        title={project.name}
        description={project.description || "Project overview and collaboration details."}
        actions={
          <div className="flex items-center gap-2">
            {project.status ? <StatusPill status={project.status} /> : null}
            {project.health ? <StatusPill status={project.health} /> : null}
            <EditProjectDialog project={project} open={editOpen} onOpenChange={setEditOpen} />
            <Button
              size="sm"
              variant="destructive"
              className="gap-1.5"
              onClick={() => setDeleteOpen(true)}
            >
              <Trash2 className="h-3.5 w-3.5" />
              Delete project
            </Button>
            <ConfirmDeleteDialog
              open={deleteOpen}
              onOpenChange={setDeleteOpen}
              title="Delete this project?"
              description="This can't be undone. All associated milestones, deliverables, risks, decisions, and participants may be removed."
              isPending={deleteProject.isPending}
              onConfirm={handleDeleteProject}
            />
          </div>
        }
      />

      <Tabs defaultValue="overview">
        <TabsList className="mb-4 flex-wrap">
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="timeline">Timeline</TabsTrigger>
          <TabsTrigger value="milestones">Milestones</TabsTrigger>
          <TabsTrigger value="deliverables">Deliverables</TabsTrigger>
          <TabsTrigger value="budget">Budget</TabsTrigger>
          <TabsTrigger value="participants">Participants</TabsTrigger>
          <TabsTrigger value="activity">Activity</TabsTrigger>
          <TabsTrigger value="risks">Risks</TabsTrigger>
          <TabsTrigger value="decisions">Decisions</TabsTrigger>
        </TabsList>

        <TabsContent value="overview">
          <Card className="glass-panel">
            <CardContent className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
              <Field label="Code" value={project.code} />
              <Field label="Status" value={project.status} />
              <Field label="Health" value={project.health} />
              <Field label="Start Date" value={project.start_date} />
              <Field label="End Date" value={project.end_date} />
              <Field
                label="Progress"
                value={
                  typeof project.progress === "number" ? `${project.progress}%` : undefined
                }
              />
              <Field
                label="Budget"
                value={(project.budget_amount ?? project.budget)?.toLocaleString()}
              />
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="timeline">
          {project.timeline && project.timeline.length > 0 ? (
            <ol className="space-y-4 border-l border-border pl-4">
              {project.timeline.map((event) => (
                <li key={event.id} className="relative">
                  <span className="absolute -left-[21px] top-1 h-2.5 w-2.5 rounded-full bg-primary" />
                  <p className="text-sm font-medium text-foreground">{event.title}</p>
                  <p className="text-xs text-muted-foreground">
                    {formatTimestamp(event.date)}
                  </p>
                  {event.description ? (
                    <p className="mt-1 text-sm text-muted-foreground">{event.description}</p>
                  ) : null}
                </li>
              ))}
            </ol>
          ) : (
            <EmptyState icon={CalendarClock} title="No timeline events yet" />
          )}
        </TabsContent>

        <TabsContent value="milestones">
          <MilestonesTab projectId={id} />
        </TabsContent>

        <TabsContent value="deliverables">
          <DeliverablesTab projectId={id} />
        </TabsContent>

        <TabsContent value="budget">
          {project.budget !== undefined ? (
            <Card className="glass-panel">
              <CardContent className="grid grid-cols-1 gap-4 sm:grid-cols-3">
                <Field label="Total Budget" value={project.budget?.toLocaleString()} />
                <Field label="Spent" value={project.spent_budget?.toLocaleString()} />
                <Field
                  label="Remaining"
                  value={
                    project.budget !== undefined && project.spent_budget !== undefined
                      ? (project.budget - project.spent_budget).toLocaleString()
                      : undefined
                  }
                />
              </CardContent>
            </Card>
          ) : (
            <EmptyState icon={Wallet} title="No budget data available" />
          )}
        </TabsContent>

        <TabsContent value="participants">
          <ParticipantsTab projectId={id} />
        </TabsContent>

        <TabsContent value="activity">
          {project.activity && project.activity.length > 0 ? (
            <div className="divide-y divide-border rounded-xl border border-border px-3">
              {project.activity.map((a) => (
                <ActivityRow key={a.id} item={a} />
              ))}
            </div>
          ) : (
            <EmptyState icon={Activity} title="No activity recorded yet" />
          )}
        </TabsContent>

        <TabsContent value="risks">
          <RisksTab projectId={id} />
        </TabsContent>

        <TabsContent value="decisions">
          <DecisionsTab projectId={id} />
        </TabsContent>
      </Tabs>
    </div>
  );
}

function EditProjectDialog({
  project,
  open,
  onOpenChange,
}: {
  project: Project;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const updateProject = useUpdateProject();
  const [name, setName] = useState(project.name ?? "");
  const [code, setCode] = useState(project.code ?? "");
  const [description, setDescription] = useState(project.description ?? "");
  const [status, setStatus] = useState<ProjectStatus>(project.status ?? "planning");
  const [health, setHealth] = useState<ProjectHealth>(project.health ?? "on_track");
  const [startDate, setStartDate] = useState(project.start_date ?? "");
  const [endDate, setEndDate] = useState(project.end_date ?? "");
  const [budgetAmount, setBudgetAmount] = useState(
    String(project.budget_amount ?? project.budget ?? ""),
  );
  const [budgetCurrency, setBudgetCurrency] = useState(project.budget_currency ?? "USD");

  useEffect(() => {
    if (!open) return;
    setName(project.name ?? "");
    setCode(project.code ?? "");
    setDescription(project.description ?? "");
    setStatus(project.status ?? "planning");
    setHealth(project.health ?? "on_track");
    setStartDate(project.start_date ?? "");
    setEndDate(project.end_date ?? "");
    setBudgetAmount(String(project.budget_amount ?? project.budget ?? ""));
    setBudgetCurrency(project.budget_currency ?? "USD");
  }, [open, project]);

  function handleSubmit() {
    if (!name.trim()) {
      toast.error("Name is required");
      return;
    }
    updateProject.mutate(
      {
        id: project.id,
        payload: {
          name,
          code: code || undefined,
          description: description || undefined,
          status,
          health,
          start_date: startDate || undefined,
          end_date: endDate || undefined,
          budget_amount: budgetAmount ? Number(budgetAmount) : undefined,
          budget_currency: budgetCurrency || undefined,
        },
      },
      {
        onSuccess: () => {
          toast.success("Project updated");
          onOpenChange(false);
        },
        onError: () => toast.error("Failed to update project"),
      },
    );
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogTrigger asChild>
        <Button size="sm" variant="outline" className="gap-1.5">
          <Pencil className="h-3.5 w-3.5" />
          Edit project
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Edit project</DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="project-name">Name</Label>
              <Input id="project-name" value={name} onChange={(e) => setName(e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="project-code">Code</Label>
              <Input id="project-code" value={code} onChange={(e) => setCode(e.target.value)} />
            </div>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="project-description">Description</Label>
            <Textarea
              id="project-description"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="project-status">Status</Label>
              <Select value={status} onValueChange={(v) => setStatus(v as ProjectStatus)}>
                <SelectTrigger id="project-status" className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {STATUS_OPTIONS.map((s) => (
                    <SelectItem key={s} value={s}>
                      {s}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="project-health">Health</Label>
              <Select value={health} onValueChange={(v) => setHealth(v as ProjectHealth)}>
                <SelectTrigger id="project-health" className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {HEALTH_OPTIONS.map((h) => (
                    <SelectItem key={h} value={h}>
                      {h}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="project-start-date">Start date</Label>
              <Input
                id="project-start-date"
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="project-end-date">End date</Label>
              <Input
                id="project-end-date"
                type="date"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
              />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="project-budget-amount">Budget amount</Label>
              <Input
                id="project-budget-amount"
                type="number"
                value={budgetAmount}
                onChange={(e) => setBudgetAmount(e.target.value)}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="project-budget-currency">Budget currency</Label>
              <Input
                id="project-budget-currency"
                value={budgetCurrency}
                onChange={(e) => setBudgetCurrency(e.target.value)}
              />
            </div>
          </div>
        </div>
        <DialogFooter>
          <Button onClick={handleSubmit} disabled={updateProject.isPending}>
            Save changes
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function Field({ label, value }: { label: string; value?: string | number }) {
  return (
    <div>
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="text-sm text-foreground">{value ?? "—"}</p>
    </div>
  );
}

function TabToolbar({ children }: { children: React.ReactNode }) {
  return <div className="mb-3 flex items-center justify-end">{children}</div>;
}

// --- Milestones ---

function MilestonesTab({ projectId }: { projectId: string }) {
  const { data, isLoading, isError, refetch } = useMilestones(projectId);
  const [createOpen, setCreateOpen] = useState(false);
  const [pendingDelete, setPendingDelete] = useState<Milestone | null>(null);
  const deleteMilestone = useDeleteMilestone();
  const milestones = data ?? [];

  function handleDelete() {
    if (!pendingDelete) return;
    deleteMilestone.mutate(
      { id: pendingDelete.id, projectId },
      {
        onSuccess: () => {
          toast.success("Milestone deleted");
          setPendingDelete(null);
        },
        onError: () => toast.error("Failed to delete milestone"),
      },
    );
  }

  return (
    <div>
      <TabToolbar>
        <CreateMilestoneDialog
          projectId={projectId}
          open={createOpen}
          onOpenChange={setCreateOpen}
        />
      </TabToolbar>
      {isLoading ? (
        <Skeleton className="h-32 w-full rounded-xl" />
      ) : isError ? (
        <ErrorState onRetry={() => refetch()} />
      ) : milestones.length > 0 ? (
        <div className="divide-y divide-border rounded-xl border border-border">
          {milestones.map((m) => (
            <div key={m.id} className="flex items-center justify-between gap-2 p-3">
              <span className="text-sm font-medium text-foreground">{m.title || m.name}</span>
              <div className="flex items-center gap-3">
                <span className="text-xs text-muted-foreground">
                  {formatTimestamp(m.due_date)}
                </span>
                {m.status ? <StatusPill status={m.status} /> : null}
                <Button
                  size="icon-sm"
                  variant="ghost"
                  aria-label="Delete milestone"
                  onClick={() => setPendingDelete(m)}
                >
                  <Trash2 className="h-3.5 w-3.5 text-destructive" />
                </Button>
              </div>
            </div>
          ))}
        </div>
      ) : (
        <EmptyState icon={MilestoneIcon} title="No milestones yet" />
      )}
      <ConfirmDeleteDialog
        open={Boolean(pendingDelete)}
        onOpenChange={(open) => !open && setPendingDelete(null)}
        title="Delete this milestone?"
        description="This can't be undone."
        isPending={deleteMilestone.isPending}
        onConfirm={handleDelete}
      />
    </div>
  );
}

function CreateMilestoneDialog({
  projectId,
  open,
  onOpenChange,
}: {
  projectId: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const createMilestone = useCreateMilestone();
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [dueDate, setDueDate] = useState("");
  const [status, setStatus] = useState<MilestoneStatus>("pending");

  function reset() {
    setTitle("");
    setDescription("");
    setDueDate("");
    setStatus("pending");
  }

  function handleSubmit() {
    if (!title.trim()) {
      toast.error("Title is required");
      return;
    }
    createMilestone.mutate(
      {
        project_id: projectId,
        title,
        description: description || undefined,
        due_date: dueDate || undefined,
        status,
      },
      {
        onSuccess: () => {
          toast.success("Milestone created");
          reset();
          onOpenChange(false);
        },
        onError: () => toast.error("Failed to create milestone"),
      },
    );
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogTrigger asChild>
        <Button size="sm" className="gap-1.5">
          <Plus className="h-3.5 w-3.5" />
          New milestone
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>New milestone</DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          <div className="space-y-1.5">
            <Label htmlFor="milestone-title">Title</Label>
            <Input id="milestone-title" value={title} onChange={(e) => setTitle(e.target.value)} />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="milestone-description">Description</Label>
            <Textarea
              id="milestone-description"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="milestone-due-date">Due date</Label>
              <Input
                id="milestone-due-date"
                type="date"
                value={dueDate}
                onChange={(e) => setDueDate(e.target.value)}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="milestone-status">Status</Label>
              <Select value={status} onValueChange={(v) => setStatus(v as MilestoneStatus)}>
                <SelectTrigger id="milestone-status" className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {MILESTONE_STATUS_OPTIONS.map((s) => (
                    <SelectItem key={s} value={s}>
                      {s.replace(/_/g, " ")}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
        </div>
        <DialogFooter>
          <Button onClick={handleSubmit} disabled={createMilestone.isPending}>
            Create
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// --- Deliverables ---

function DeliverablesTab({ projectId }: { projectId: string }) {
  const { data, isLoading, isError, refetch } = useDeliverables(projectId);
  const [createOpen, setCreateOpen] = useState(false);
  const [pendingDelete, setPendingDelete] = useState<Deliverable | null>(null);
  const deleteDeliverable = useDeleteDeliverable();
  const deliverables = data ?? [];

  function handleDelete() {
    if (!pendingDelete) return;
    deleteDeliverable.mutate(
      { id: pendingDelete.id, projectId },
      {
        onSuccess: () => {
          toast.success("Deliverable deleted");
          setPendingDelete(null);
        },
        onError: () => toast.error("Failed to delete deliverable"),
      },
    );
  }

  return (
    <div>
      <TabToolbar>
        <CreateDeliverableDialog
          projectId={projectId}
          open={createOpen}
          onOpenChange={setCreateOpen}
        />
      </TabToolbar>
      {isLoading ? (
        <Skeleton className="h-32 w-full rounded-xl" />
      ) : isError ? (
        <ErrorState onRetry={() => refetch()} />
      ) : deliverables.length > 0 ? (
        <div className="divide-y divide-border rounded-xl border border-border">
          {deliverables.map((d) => (
            <div key={d.id} className="flex items-center justify-between gap-2 p-3">
              <div>
                <p className="text-sm font-medium text-foreground">{d.title}</p>
                {d.owner || d.owner_name ? (
                  <p className="text-xs text-muted-foreground">Owner: {d.owner || d.owner_name}</p>
                ) : null}
              </div>
              <div className="flex items-center gap-3">
                <span className="text-xs text-muted-foreground">
                  {formatTimestamp(d.due_date)}
                </span>
                {d.status ? <StatusPill status={d.status} /> : null}
                <Button
                  size="icon-sm"
                  variant="ghost"
                  aria-label="Delete deliverable"
                  onClick={() => setPendingDelete(d)}
                >
                  <Trash2 className="h-3.5 w-3.5 text-destructive" />
                </Button>
              </div>
            </div>
          ))}
        </div>
      ) : (
        <EmptyState icon={Package} title="No deliverables recorded" />
      )}
      <ConfirmDeleteDialog
        open={Boolean(pendingDelete)}
        onOpenChange={(open) => !open && setPendingDelete(null)}
        title="Delete this deliverable?"
        description="This can't be undone."
        isPending={deleteDeliverable.isPending}
        onConfirm={handleDelete}
      />
    </div>
  );
}

function CreateDeliverableDialog({
  projectId,
  open,
  onOpenChange,
}: {
  projectId: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const createDeliverable = useCreateDeliverable();
  const { data: milestones } = useMilestones(projectId);
  const { data: users } = useUsers();
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [dueDate, setDueDate] = useState("");
  const [status, setStatus] = useState<DeliverableStatus>("pending");
  const [milestoneId, setMilestoneId] = useState("");
  const [ownerId, setOwnerId] = useState("");

  function reset() {
    setTitle("");
    setDescription("");
    setDueDate("");
    setStatus("pending");
    setMilestoneId("");
    setOwnerId("");
  }

  function handleSubmit() {
    if (!title.trim()) {
      toast.error("Title is required");
      return;
    }
    createDeliverable.mutate(
      {
        project_id: projectId,
        milestone_id: milestoneId || undefined,
        title,
        description: description || undefined,
        due_date: dueDate || undefined,
        status,
        owner_user_id: ownerId || undefined,
      },
      {
        onSuccess: () => {
          toast.success("Deliverable created");
          reset();
          onOpenChange(false);
        },
        onError: () => toast.error("Failed to create deliverable"),
      },
    );
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogTrigger asChild>
        <Button size="sm" className="gap-1.5">
          <Plus className="h-3.5 w-3.5" />
          New deliverable
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>New deliverable</DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          <div className="space-y-1.5">
            <Label htmlFor="deliverable-title">Title</Label>
            <Input
              id="deliverable-title"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="deliverable-description">Description</Label>
            <Textarea
              id="deliverable-description"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="deliverable-milestone">Milestone</Label>
            <Select
              value={milestoneId || "none"}
              onValueChange={(v) => setMilestoneId(v === "none" ? "" : v)}
            >
              <SelectTrigger id="deliverable-milestone" className="w-full">
                <SelectValue placeholder="None" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="none">None</SelectItem>
                {(milestones ?? []).map((m) => (
                  <SelectItem key={m.id} value={m.id}>
                    {m.title || m.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="deliverable-due-date">Due date</Label>
              <Input
                id="deliverable-due-date"
                type="date"
                value={dueDate}
                onChange={(e) => setDueDate(e.target.value)}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="deliverable-status">Status</Label>
              <Select value={status} onValueChange={(v) => setStatus(v as DeliverableStatus)}>
                <SelectTrigger id="deliverable-status" className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {DELIVERABLE_STATUS_OPTIONS.map((s) => (
                    <SelectItem key={s} value={s}>
                      {s.replace(/_/g, " ")}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="deliverable-owner">Owner</Label>
            <Select
              value={ownerId || "unassigned"}
              onValueChange={(v) => setOwnerId(v === "unassigned" ? "" : v)}
            >
              <SelectTrigger id="deliverable-owner" className="w-full">
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
          <Button onClick={handleSubmit} disabled={createDeliverable.isPending}>
            Create
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// --- Risks ---

function RisksTab({ projectId }: { projectId: string }) {
  const { data, isLoading, isError, refetch } = useRisks(projectId);
  const [createOpen, setCreateOpen] = useState(false);
  const [pendingDelete, setPendingDelete] = useState<Risk | null>(null);
  const deleteRisk = useDeleteRisk();
  const risks = data ?? [];

  function handleDelete() {
    if (!pendingDelete) return;
    deleteRisk.mutate(
      { id: pendingDelete.id, projectId },
      {
        onSuccess: () => {
          toast.success("Risk deleted");
          setPendingDelete(null);
        },
        onError: () => toast.error("Failed to delete risk"),
      },
    );
  }

  return (
    <div>
      <TabToolbar>
        <CreateRiskDialog projectId={projectId} open={createOpen} onOpenChange={setCreateOpen} />
      </TabToolbar>
      {isLoading ? (
        <Skeleton className="h-32 w-full rounded-xl" />
      ) : isError ? (
        <ErrorState onRetry={() => refetch()} />
      ) : risks.length > 0 ? (
        <div className="space-y-3">
          {risks.map((risk) => (
            <Card key={risk.id} className="glass-panel">
              <CardContent className="flex items-start justify-between gap-2">
                <div>
                  <p className="text-sm font-medium text-foreground">{risk.title}</p>
                  {risk.description ? (
                    <p className="text-xs text-muted-foreground">{risk.description}</p>
                  ) : null}
                </div>
                <div className="flex items-center gap-2">
                  {risk.severity ? <StatusPill status={risk.severity} /> : null}
                  {risk.status ? <StatusPill status={risk.status} /> : null}
                  <Button
                    size="icon-sm"
                    variant="ghost"
                    aria-label="Delete risk"
                    onClick={() => setPendingDelete(risk)}
                  >
                    <Trash2 className="h-3.5 w-3.5 text-destructive" />
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      ) : (
        <EmptyState icon={ShieldAlert} title="No risks logged" />
      )}
      <ConfirmDeleteDialog
        open={Boolean(pendingDelete)}
        onOpenChange={(open) => !open && setPendingDelete(null)}
        title="Delete this risk?"
        description="This can't be undone."
        isPending={deleteRisk.isPending}
        onConfirm={handleDelete}
      />
    </div>
  );
}

function CreateRiskDialog({
  projectId,
  open,
  onOpenChange,
}: {
  projectId: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const createRisk = useCreateRisk();
  const { data: users } = useUsers();
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [severity, setSeverity] = useState<RiskSeverity>("medium");
  const [likelihood, setLikelihood] = useState<RiskLikelihood>("medium");
  const [status, setStatus] = useState<RiskStatus>("open");
  const [ownerId, setOwnerId] = useState("");

  function reset() {
    setTitle("");
    setDescription("");
    setSeverity("medium");
    setLikelihood("medium");
    setStatus("open");
    setOwnerId("");
  }

  function handleSubmit() {
    if (!title.trim()) {
      toast.error("Title is required");
      return;
    }
    createRisk.mutate(
      {
        project_id: projectId,
        title,
        description: description || undefined,
        severity,
        likelihood,
        status,
        owner_user_id: ownerId || undefined,
      },
      {
        onSuccess: () => {
          toast.success("Risk created");
          reset();
          onOpenChange(false);
        },
        onError: () => toast.error("Failed to create risk"),
      },
    );
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogTrigger asChild>
        <Button size="sm" className="gap-1.5">
          <Plus className="h-3.5 w-3.5" />
          New risk
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>New risk</DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          <div className="space-y-1.5">
            <Label htmlFor="risk-title">Title</Label>
            <Input id="risk-title" value={title} onChange={(e) => setTitle(e.target.value)} />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="risk-description">Description</Label>
            <Textarea
              id="risk-description"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
            />
          </div>
          <div className="grid grid-cols-3 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="risk-severity">Severity</Label>
              <Select value={severity} onValueChange={(v) => setSeverity(v as RiskSeverity)}>
                <SelectTrigger id="risk-severity" className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {RISK_SEVERITY_OPTIONS.map((s) => (
                    <SelectItem key={s} value={s}>
                      {s}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="risk-likelihood">Likelihood</Label>
              <Select
                value={likelihood}
                onValueChange={(v) => setLikelihood(v as RiskLikelihood)}
              >
                <SelectTrigger id="risk-likelihood" className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {RISK_LIKELIHOOD_OPTIONS.map((l) => (
                    <SelectItem key={l} value={l}>
                      {l}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="risk-status">Status</Label>
              <Select value={status} onValueChange={(v) => setStatus(v as RiskStatus)}>
                <SelectTrigger id="risk-status" className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {RISK_STATUS_OPTIONS.map((s) => (
                    <SelectItem key={s} value={s}>
                      {s}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="risk-owner">Owner</Label>
            <Select
              value={ownerId || "unassigned"}
              onValueChange={(v) => setOwnerId(v === "unassigned" ? "" : v)}
            >
              <SelectTrigger id="risk-owner" className="w-full">
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
          <Button onClick={handleSubmit} disabled={createRisk.isPending}>
            Create
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// --- Decisions ---

function DecisionsTab({ projectId }: { projectId: string }) {
  const { data, isLoading, isError, refetch } = useDecisions(projectId);
  const [createOpen, setCreateOpen] = useState(false);
  const [pendingDelete, setPendingDelete] = useState<Decision | null>(null);
  const deleteDecision = useDeleteDecision();
  const decisions = data ?? [];

  function handleDelete() {
    if (!pendingDelete) return;
    deleteDecision.mutate(
      { id: pendingDelete.id, projectId },
      {
        onSuccess: () => {
          toast.success("Decision deleted");
          setPendingDelete(null);
        },
        onError: () => toast.error("Failed to delete decision"),
      },
    );
  }

  return (
    <div>
      <TabToolbar>
        <CreateDecisionDialog
          projectId={projectId}
          open={createOpen}
          onOpenChange={setCreateOpen}
        />
      </TabToolbar>
      {isLoading ? (
        <Skeleton className="h-32 w-full rounded-xl" />
      ) : isError ? (
        <ErrorState onRetry={() => refetch()} />
      ) : decisions.length > 0 ? (
        <div className="space-y-3">
          {decisions.map((decision) => (
            <Card key={decision.id} className="glass-panel">
              <CardContent className="flex items-start justify-between gap-2">
                <div>
                  <p className="text-sm font-medium text-foreground">{decision.title}</p>
                  <p className="text-xs text-muted-foreground">
                    {decision.decided_by ? `${decision.decided_by} · ` : ""}
                    {formatTimestamp(decision.decision_date || decision.date)}
                  </p>
                  {decision.description ? (
                    <p className="mt-1 text-sm text-muted-foreground">{decision.description}</p>
                  ) : null}
                </div>
                <div className="flex items-center gap-2">
                  {decision.status ? <StatusPill status={decision.status} /> : null}
                  <Button
                    size="icon-sm"
                    variant="ghost"
                    aria-label="Delete decision"
                    onClick={() => setPendingDelete(decision)}
                  >
                    <Trash2 className="h-3.5 w-3.5 text-destructive" />
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      ) : (
        <EmptyState icon={Gavel} title="No decisions logged" />
      )}
      <ConfirmDeleteDialog
        open={Boolean(pendingDelete)}
        onOpenChange={(open) => !open && setPendingDelete(null)}
        title="Delete this decision?"
        description="This can't be undone."
        isPending={deleteDecision.isPending}
        onConfirm={handleDelete}
      />
    </div>
  );
}

function CreateDecisionDialog({
  projectId,
  open,
  onOpenChange,
}: {
  projectId: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const createDecision = useCreateDecision();
  const { data: users } = useUsers();
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [decidedByUserId, setDecidedByUserId] = useState("");
  const [decisionDate, setDecisionDate] = useState("");
  const [status, setStatus] = useState<DecisionStatus>("proposed");

  function reset() {
    setTitle("");
    setDescription("");
    setDecidedByUserId("");
    setDecisionDate("");
    setStatus("proposed");
  }

  function handleSubmit() {
    if (!title.trim()) {
      toast.error("Title is required");
      return;
    }
    createDecision.mutate(
      {
        project_id: projectId,
        title,
        description: description || undefined,
        decided_by_user_id: decidedByUserId || undefined,
        decision_date: decisionDate || undefined,
        status,
      },
      {
        onSuccess: () => {
          toast.success("Decision created");
          reset();
          onOpenChange(false);
        },
        onError: () => toast.error("Failed to create decision"),
      },
    );
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogTrigger asChild>
        <Button size="sm" className="gap-1.5">
          <Plus className="h-3.5 w-3.5" />
          New decision
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>New decision</DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          <div className="space-y-1.5">
            <Label htmlFor="decision-title">Title</Label>
            <Input
              id="decision-title"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="decision-description">Description</Label>
            <Textarea
              id="decision-description"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="decision-date">Decision date</Label>
              <Input
                id="decision-date"
                type="date"
                value={decisionDate}
                onChange={(e) => setDecisionDate(e.target.value)}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="decision-status">Status</Label>
              <Select value={status} onValueChange={(v) => setStatus(v as DecisionStatus)}>
                <SelectTrigger id="decision-status" className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {DECISION_STATUS_OPTIONS.map((s) => (
                    <SelectItem key={s} value={s}>
                      {s}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="decision-decided-by">Decided by</Label>
            <Select
              value={decidedByUserId || "unassigned"}
              onValueChange={(v) => setDecidedByUserId(v === "unassigned" ? "" : v)}
            >
              <SelectTrigger id="decision-decided-by" className="w-full">
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
          <Button onClick={handleSubmit} disabled={createDecision.isPending}>
            Create
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// --- Participants ---

function ParticipantsTab({ projectId }: { projectId: string }) {
  const { data, isLoading, isError, refetch } = useProjectParticipants(projectId);
  const [createOpen, setCreateOpen] = useState(false);
  const [pendingDelete, setPendingDelete] = useState<ProjectParticipant | null>(null);
  const deleteParticipant = useDeleteProjectParticipant();
  const participants = data ?? [];

  function handleDelete() {
    if (!pendingDelete) return;
    deleteParticipant.mutate(
      { id: pendingDelete.id, projectId },
      {
        onSuccess: () => {
          toast.success("Participant removed");
          setPendingDelete(null);
        },
        onError: () => toast.error("Failed to remove participant"),
      },
    );
  }

  return (
    <div>
      <TabToolbar>
        <CreateParticipantDialog
          projectId={projectId}
          open={createOpen}
          onOpenChange={setCreateOpen}
        />
      </TabToolbar>
      {isLoading ? (
        <Skeleton className="h-32 w-full rounded-xl" />
      ) : isError ? (
        <ErrorState onRetry={() => refetch()} />
      ) : participants.length > 0 ? (
        <div className="divide-y divide-border rounded-xl border border-border">
          {participants.map((p) => (
            <div key={p.id} className="flex items-center gap-3 p-3">
              <Avatar className="h-9 w-9">
                <AvatarImage src={p.avatar_url} alt={p.user_name} />
                <AvatarFallback className="bg-primary/10 text-xs text-primary">
                  {(p.user_name || "?").slice(0, 2).toUpperCase()}
                </AvatarFallback>
              </Avatar>
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium text-foreground">
                  {p.user_name || "Unknown user"}
                </p>
                <p className="truncate text-xs text-muted-foreground">
                  {p.role_on_project} {p.organization_name ? `· ${p.organization_name}` : ""}
                </p>
              </div>
              <Button
                size="icon-sm"
                variant="ghost"
                aria-label="Remove participant"
                onClick={() => setPendingDelete(p)}
              >
                <Trash2 className="h-3.5 w-3.5 text-destructive" />
              </Button>
            </div>
          ))}
        </div>
      ) : (
        <EmptyState icon={Users2} title="No participants listed" />
      )}
      <ConfirmDeleteDialog
        open={Boolean(pendingDelete)}
        onOpenChange={(open) => !open && setPendingDelete(null)}
        title="Remove this participant?"
        description="This can't be undone."
        isPending={deleteParticipant.isPending}
        onConfirm={handleDelete}
      />
    </div>
  );
}

function CreateParticipantDialog({
  projectId,
  open,
  onOpenChange,
}: {
  projectId: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const createParticipant = useCreateProjectParticipant();
  const { data: users } = useUsers();
  const { data: organizations } = useOrganizations();
  const [userId, setUserId] = useState("");
  const [organizationId, setOrganizationId] = useState("");
  const [roleOnProject, setRoleOnProject] = useState("");

  function reset() {
    setUserId("");
    setOrganizationId("");
    setRoleOnProject("");
  }

  function handleSubmit() {
    if (!userId) {
      toast.error("Select a user");
      return;
    }
    createParticipant.mutate(
      {
        project_id: projectId,
        user_id: userId,
        organization_id: organizationId || undefined,
        role_on_project: roleOnProject || undefined,
      },
      {
        onSuccess: () => {
          toast.success("Participant added");
          reset();
          onOpenChange(false);
        },
        onError: () => toast.error("Failed to add participant"),
      },
    );
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogTrigger asChild>
        <Button size="sm" className="gap-1.5">
          <Plus className="h-3.5 w-3.5" />
          New participant
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>New participant</DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          <div className="space-y-1.5">
            <Label htmlFor="participant-user">User</Label>
            <Select value={userId} onValueChange={setUserId}>
              <SelectTrigger id="participant-user" className="w-full">
                <SelectValue placeholder="Select user" />
              </SelectTrigger>
              <SelectContent>
                {(users ?? []).map((u) => (
                  <SelectItem key={u.id} value={u.id}>
                    {u.full_name || u.email}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="participant-org">Organization</Label>
            <Select
              value={organizationId || "none"}
              onValueChange={(v) => setOrganizationId(v === "none" ? "" : v)}
            >
              <SelectTrigger id="participant-org" className="w-full">
                <SelectValue placeholder="None" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="none">None</SelectItem>
                {(organizations ?? []).map((o) => (
                  <SelectItem key={o.id} value={o.id}>
                    {o.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="participant-role">Role on project</Label>
            <Input
              id="participant-role"
              value={roleOnProject}
              onChange={(e) => setRoleOnProject(e.target.value)}
              placeholder="e.g. Site Engineer"
            />
          </div>
        </div>
        <DialogFooter>
          <Button onClick={handleSubmit} disabled={createParticipant.isPending}>
            Create
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
