"use client";

import { use, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import {
  FolderKanban,
  CalendarClock,
  Milestone as MilestoneIcon,
  Package,
  Wallet,
  Users2,
  ShieldAlert,
  Gavel,
  Pencil,
  Plus,
  Trash2,
  Mail,
  Paperclip,
  Download,
  MessageSquarePlus,
  MessageCircle,
  Send,
} from "lucide-react";
import { toast } from "sonner";
import { PageHeader } from "@/components/ui-custom/page-header";
import { EmptyState } from "@/components/ui-custom/empty-state";
import { ErrorState } from "@/components/ui-custom/error-state";
import { StatusPill } from "@/components/ui-custom/status-pill";
import { ConfirmDeleteDialog } from "@/components/ui-custom/confirm-delete-dialog";
import { formatTimestamp } from "@/components/ui-custom/activity-row";
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
import {
  useAddProjectUpdateComment,
  useCreateProjectUpdate,
  useDeleteProjectUpdate,
  useDeleteProjectUpdateAttachment,
  useEditProjectUpdate,
  useMarkProjectUpdateDone,
  useProjectUpdates,
  useSetProjectUpdateStatus,
  useUploadProjectUpdateAttachment,
} from "@/lib/hooks/use-project-updates";
import { useCurrentUser } from "@/lib/hooks/use-auth";
import { api } from "@/lib/api-client";
import type { ProjectUpdate } from "@/lib/types";
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
          <TabsTrigger value="updates">Updates</TabsTrigger>
          <TabsTrigger value="timeline">Timeline</TabsTrigger>
          <TabsTrigger value="milestones">Milestones</TabsTrigger>
          <TabsTrigger value="deliverables">Deliverables</TabsTrigger>
          <TabsTrigger value="budget">Budget</TabsTrigger>
          <TabsTrigger value="participants">Participants</TabsTrigger>
          <TabsTrigger value="risks">Risks</TabsTrigger>
          <TabsTrigger value="decisions">Decisions</TabsTrigger>
        </TabsList>

        <TabsContent value="updates">
          <ProjectUpdatesTab projectId={id} />
        </TabsContent>

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

// --- Project Updates ---

const CAN_DELETE_EMAILS = new Set(["pmureithi@usm.co.ke", "hkotecha@kwale-group.com"]);

function canDeleteUpdate(user: { email?: string; role?: string | { name?: string } } | undefined): boolean {
  if (!user) return false;
  if (user.email && CAN_DELETE_EMAILS.has(user.email)) return true;
  if (typeof user.role === "string") return user.role.toLowerCase().includes("admin");
  return (user.role as { name?: string })?.name?.toLowerCase().includes("admin") ?? false;
}

function formatBytes(bytes?: number) {
  if (!bytes) return "";
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function ProjectUpdatesTab({ projectId }: { projectId: string }) {
  const { data, isLoading, isError, refetch } = useProjectUpdates(projectId);
  const { data: currentUser } = useCurrentUser();
  const createUpdate = useCreateProjectUpdate(projectId);
  const uploadAttachment = useUploadProjectUpdateAttachment(projectId);
  const canDelete = canDeleteUpdate(currentUser);

  const [showPostForm, setShowPostForm] = useState(false);
  const [body, setBody] = useState("");
  const [source, setSource] = useState("internal");
  const [emailFrom, setEmailFrom] = useState("");
  const [emailSubject, setEmailSubject] = useState("");
  const [postedAt, setPostedAt] = useState(() => new Date().toISOString().slice(0, 10));
  const [currentCapacity, setCurrentCapacity] = useState("");
  const [projectRequirement, setProjectRequirement] = useState("");
  const [internalNotes, setInternalNotes] = useState("");
  const [actionItems, setActionItems] = useState("");
  const [pendingFiles, setPendingFiles] = useState<File[]>([]);
  const [posting, setPosting] = useState(false);
  const [parentUpdateId, setParentUpdateId] = useState<string>("");
  const [showLinkPanel, setShowLinkPanel] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const updates = data ?? [];

  async function handlePost() {
    if (!body.trim()) {
      toast.error("Update field is required");
      return;
    }
    setPosting(true);
    try {
      const created = await createUpdate.mutateAsync({
        body: body.trim(),
        source,
        email_from: emailFrom.trim() || undefined,
        email_subject: emailSubject.trim() || undefined,
        posted_at: postedAt ? new Date(postedAt).toISOString() : undefined,
        parent_update_id: parentUpdateId || undefined,
        current_capacity: currentCapacity.trim() || undefined,
        project_requirement: projectRequirement.trim() || undefined,
        internal_notes: internalNotes.trim() || undefined,
        action_items: actionItems.trim() || undefined,
      });
      for (const file of pendingFiles) {
        await uploadAttachment.mutateAsync({ updateId: created.id, file });
      }
      setBody("");
      setSource("internal");
      setEmailFrom("");
      setEmailSubject("");
      setPostedAt(new Date().toISOString().slice(0, 10));
      setCurrentCapacity("");
      setProjectRequirement("");
      setInternalNotes("");
      setActionItems("");
      setPendingFiles([]);
      setParentUpdateId("");
      setShowLinkPanel(false);
      setShowPostForm(false);
      toast.success("Update posted");
    } catch {
      toast.error("Failed to post update");
    } finally {
      setPosting(false);
    }
  }

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const files = Array.from(e.target.files ?? []);
    setPendingFiles((prev) => [...prev, ...files]);
    e.target.value = "";
  }

  function removeFile(index: number) {
    setPendingFiles((prev) => prev.filter((_, i) => i !== index));
  }

  const selectedParent = updates.find((u) => u.id === parentUpdateId);

  return (
    <div className="space-y-6">
      {/* Post form — collapsed by default */}
      <div className="rounded-xl border border-border space-y-0">
        {/* Header / toggle */}
        <div
          className="flex items-center justify-between p-4 cursor-pointer select-none"
          onClick={() => setShowPostForm((v) => !v)}
        >
          <p className="text-sm font-semibold text-foreground">Post an update</p>
          <div className="flex gap-2" onClick={(e) => e.stopPropagation()}>
            {!showPostForm && (
              <Button size="sm" className="gap-1.5" onClick={() => setShowPostForm(true)}>
                <Plus className="h-3.5 w-3.5" />
                Add update
              </Button>
            )}
            {showPostForm && (
              <>
                <button
                  onClick={() => setSource("internal")}
                  className={`rounded-md px-3 py-1.5 text-xs font-medium transition-colors ${source === "internal" ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground hover:bg-muted/80"}`}
                >
                  Internal
                </button>
                <button
                  onClick={() => setSource("email")}
                  className={`flex items-center gap-1 rounded-md px-3 py-1.5 text-xs font-medium transition-colors ${source === "email" ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground hover:bg-muted/80"}`}
                >
                  <Mail className="h-3 w-3" />
                  Email
                </button>
                <Button size="sm" variant="ghost" onClick={() => setShowPostForm(false)}>
                  Cancel
                </Button>
              </>
            )}
          </div>
        </div>

        {/* Expanded form body */}
        {showPostForm && <div className="px-4 pb-4 space-y-4 border-t border-border pt-4">

        {/* Row 1: Date */}
        <div className="space-y-1">
          <Label htmlFor="posted-at" className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Date</Label>
          <Input
            id="posted-at"
            type="date"
            value={postedAt}
            max={new Date().toISOString().slice(0, 10)}
            onChange={(e) => setPostedAt(e.target.value)}
            className="w-44"
          />
        </div>

        {source === "email" && (
          <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
            <div className="space-y-1">
              <Label htmlFor="email-from" className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">From</Label>
              <Input
                id="email-from"
                placeholder="sender@example.com"
                value={emailFrom}
                onChange={(e) => setEmailFrom(e.target.value)}
              />
            </div>
            <div className="space-y-1">
              <Label htmlFor="email-subject" className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Subject</Label>
              <Input
                id="email-subject"
                placeholder="Re: Project update…"
                value={emailSubject}
                onChange={(e) => setEmailSubject(e.target.value)}
              />
            </div>
          </div>
        )}

        {/* Row 2: Current Capacities */}
        <div className="space-y-1">
          <Label htmlFor="current-capacity" className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Current Capacities</Label>
          <Textarea
            id="current-capacity"
            placeholder="Current team / resource capacities…"
            value={currentCapacity}
            onChange={(e) => setCurrentCapacity(e.target.value)}
            className="min-h-[72px]"
          />
        </div>

        {/* Row 3: Project Requirement */}
        <div className="space-y-1">
          <Label htmlFor="project-requirement" className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Project Requirement</Label>
          <Textarea
            id="project-requirement"
            placeholder="What is required for this project…"
            value={projectRequirement}
            onChange={(e) => setProjectRequirement(e.target.value)}
            className="min-h-[72px]"
          />
        </div>

        {/* Row 4: Update (main body) */}
        <div className="space-y-1">
          <Label htmlFor="update-body" className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Update <span className="text-destructive">*</span></Label>
          <Textarea
            id="update-body"
            placeholder={source === "email" ? "Paste or summarise the email content…" : "What is the update?"}
            value={body}
            onChange={(e) => setBody(e.target.value)}
            className="min-h-[100px]"
          />
        </div>

        {/* Row 5: Comments */}
        <div className="space-y-1">
          <Label htmlFor="internal-notes" className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Comments</Label>
          <Textarea
            id="internal-notes"
            placeholder="Additional comments…"
            value={internalNotes}
            onChange={(e) => setInternalNotes(e.target.value)}
            className="min-h-[72px]"
          />
        </div>

        {/* Row 6: Remarks */}
        <div className="space-y-1">
          <Label htmlFor="action-items" className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Remarks</Label>
          <Textarea
            id="action-items"
            placeholder="Remarks / action items…"
            value={actionItems}
            onChange={(e) => setActionItems(e.target.value)}
            className="min-h-[72px]"
          />
        </div>

        {/* Follow-up link */}
        <div className="space-y-1">
          <button
            type="button"
            onClick={() => { setShowLinkPanel((v) => !v); if (showLinkPanel) setParentUpdateId(""); }}
            className={`text-xs font-medium transition-colors ${showLinkPanel ? "text-primary" : "text-muted-foreground hover:text-foreground"}`}
          >
            {showLinkPanel ? "↩ Linked as follow-up" : "+ Mark as follow-up to an existing update"}
          </button>
          {showLinkPanel && (
            <div className="space-y-1.5">
              <Select value={parentUpdateId} onValueChange={setParentUpdateId}>
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="Choose update to link to…" />
                </SelectTrigger>
                <SelectContent>
                  {updates.map((u) => (
                    <SelectItem key={u.id} value={u.id}>
                      <span className="text-xs text-muted-foreground mr-1">{u.posted_at.slice(0, 10)}</span>
                      {u.body.slice(0, 60)}{u.body.length > 60 ? "…" : ""}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {selectedParent && (
                <div className="rounded-md border-l-2 border-primary bg-muted/60 px-3 py-2 text-xs text-muted-foreground">
                  <span className="font-medium text-foreground">Following up on: </span>
                  {selectedParent.body.slice(0, 100)}{selectedParent.body.length > 100 ? "…" : ""}
                </div>
              )}
            </div>
          )}
        </div>

        {pendingFiles.length > 0 && (
          <div className="space-y-1">
            {pendingFiles.map((f, i) => (
              <div key={i} className="flex items-center justify-between rounded-md bg-muted px-3 py-1.5 text-xs">
                <span className="truncate text-foreground">{f.name}</span>
                <button onClick={() => removeFile(i)} className="ml-2 shrink-0 text-muted-foreground hover:text-destructive">✕</button>
              </div>
            ))}
          </div>
        )}

        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" className="gap-1.5" onClick={() => fileInputRef.current?.click()}>
            <Paperclip className="h-3.5 w-3.5" />
            Attach files
          </Button>
          <input ref={fileInputRef} type="file" multiple hidden onChange={handleFileChange} />
          <Button size="sm" onClick={handlePost} disabled={posting || !body.trim()} className="ml-auto gap-1.5">
            <MessageSquarePlus className="h-3.5 w-3.5" />
            {posting ? "Posting…" : "Post update"}
          </Button>
        </div>
        </div>}
      </div>

      {/* Feed — table view */}
      {isLoading ? (
        <div className="space-y-2">
          {Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-12 w-full rounded-lg" />)}
        </div>
      ) : isError ? (
        <ErrorState onRetry={() => refetch()} />
      ) : updates.length === 0 ? (
        <EmptyState icon={MessageSquarePlus} title="No updates yet" description="Post the first update above." />
      ) : (
        <div className="overflow-x-auto rounded-xl border border-border">
          <table className="w-full text-sm min-w-[960px] border-collapse">
            <thead>
              <tr className="border-b border-border bg-muted/60">
                <th className="px-3 py-2.5 text-left text-[10px] font-semibold uppercase tracking-wide text-muted-foreground whitespace-nowrap w-24">Date</th>
                <th className="px-3 py-2.5 text-left text-[10px] font-semibold uppercase tracking-wide text-muted-foreground w-28">Status</th>
                <th className="px-3 py-2.5 text-left text-[10px] font-semibold uppercase tracking-wide text-muted-foreground w-36">Current Capacities</th>
                <th className="px-3 py-2.5 text-left text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">Project Requirement</th>
                <th className="px-3 py-2.5 text-left text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">Update</th>
                <th className="px-3 py-2.5 text-left text-[10px] font-semibold uppercase tracking-wide text-muted-foreground w-40">Comments</th>
                <th className="px-3 py-2.5 text-left text-[10px] font-semibold uppercase tracking-wide text-muted-foreground w-40">Remarks</th>
                <th className="px-3 py-2.5 w-28"></th>
              </tr>
            </thead>
            <tbody>
              {updates.map((update) => (
                <UpdateTableRow key={update.id} update={update} projectId={projectId} canDelete={canDelete} allUpdates={updates} />
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

function UpdateTableRow({
  update,
  projectId,
  canDelete,
  allUpdates,
}: {
  update: ProjectUpdate;
  projectId: string;
  canDelete: boolean;
  allUpdates: ProjectUpdate[];
}) {
  const editUpdate = useEditProjectUpdate(projectId);
  const deleteUpdate = useDeleteProjectUpdate(projectId);
  const deleteAttachment = useDeleteProjectUpdateAttachment(projectId);
  const setStatus = useSetProjectUpdateStatus(projectId);
  const addComment = useAddProjectUpdateComment(projectId);

  const [expanded, setExpanded] = useState(false);
  const [editing, setEditing] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [confirmDeleteAttId, setConfirmDeleteAttId] = useState<string | null>(null);
  const [editBody, setEditBody] = useState(update.body);
  const [editDate, setEditDate] = useState(update.posted_at.slice(0, 10));
  const [editEmailFrom, setEditEmailFrom] = useState(update.email_from ?? "");
  const [editEmailSubject, setEditEmailSubject] = useState(update.email_subject ?? "");
  const [editCurrentCapacity, setEditCurrentCapacity] = useState(update.current_capacity ?? "");
  const [editProjectRequirement, setEditProjectRequirement] = useState(update.project_requirement ?? "");
  const [editInternalNotes, setEditInternalNotes] = useState(update.internal_notes ?? "");
  const [editActionItems, setEditActionItems] = useState(update.action_items ?? "");
  const [commentBody, setCommentBody] = useState("");

  const STATUS_CLASS: Record<string, string> = {
    open: "bg-muted text-muted-foreground",
    in_progress: "bg-amber-100 text-amber-700 dark:bg-amber-950 dark:text-amber-300",
    done: "bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300",
  };
  const currentStatus = update.status || "open";

  function startEdit() {
    setEditBody(update.body);
    setEditDate(update.posted_at.slice(0, 10));
    setEditEmailFrom(update.email_from ?? "");
    setEditEmailSubject(update.email_subject ?? "");
    setEditCurrentCapacity(update.current_capacity ?? "");
    setEditProjectRequirement(update.project_requirement ?? "");
    setEditInternalNotes(update.internal_notes ?? "");
    setEditActionItems(update.action_items ?? "");
    setEditing(true);
    setExpanded(true);
  }

  function handleSave() {
    if (!editBody.trim()) return;
    editUpdate.mutate(
      {
        updateId: update.id,
        payload: {
          body: editBody.trim(),
          posted_at: editDate ? new Date(editDate).toISOString() : undefined,
          email_from: editEmailFrom || undefined,
          email_subject: editEmailSubject || undefined,
          current_capacity: editCurrentCapacity || undefined,
          project_requirement: editProjectRequirement || undefined,
          internal_notes: editInternalNotes || undefined,
          action_items: editActionItems || undefined,
        },
      },
      {
        onSuccess: () => { setEditing(false); toast.success("Update saved"); },
        onError: () => toast.error("Failed to save update"),
      },
    );
  }

  const parentUpdate = update.parent_update_id
    ? allUpdates.find((u) => u.id === update.parent_update_id)
    : null;
  const parentSnippet = parentUpdate?.body ?? update.parent_body_snippet;

  const rowBase = `border-b border-border transition-colors ${currentStatus === "done" ? "opacity-60" : ""} ${update.parent_update_id ? "bg-primary/5" : ""}`;

  return (
    <>
      {/* Summary row */}
      <tr
        className={`${rowBase} cursor-pointer hover:bg-muted/40`}
        onClick={() => { if (!editing) setExpanded((v) => !v); }}
      >
        <td className="px-3 py-2.5 align-top whitespace-nowrap text-xs text-muted-foreground">
          {update.posted_at.slice(0, 10)}
          {update.parent_update_id && (
            <span className="ml-1 text-primary text-[9px] font-medium">↩</span>
          )}
        </td>
        {/* Status dropdown */}
        <td className="px-3 py-2.5 align-top" onClick={(e) => e.stopPropagation()}>
          <Select
            value={currentStatus}
            onValueChange={(val) => setStatus.mutate({ updateId: update.id, status: val })}
            disabled={setStatus.isPending}
          >
            <SelectTrigger className={`h-6 rounded-full border-0 px-2.5 py-0 text-[10px] font-semibold w-auto min-w-[84px] focus:ring-0 ${STATUS_CLASS[currentStatus] ?? STATUS_CLASS.open}`}>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="open" className="text-xs">Open</SelectItem>
              <SelectItem value="in_progress" className="text-xs">In Progress</SelectItem>
              <SelectItem value="done" className="text-xs">Done</SelectItem>
            </SelectContent>
          </Select>
        </td>
        <td className="px-3 py-2.5 align-top text-xs text-foreground">
          <p className="line-clamp-2 whitespace-pre-wrap">{update.current_capacity || <span className="text-muted-foreground">—</span>}</p>
        </td>
        <td className="px-3 py-2.5 align-top text-xs text-foreground">
          <p className="line-clamp-2 whitespace-pre-wrap">{update.project_requirement || <span className="text-muted-foreground">—</span>}</p>
        </td>
        <td className="px-3 py-2.5 align-top text-xs text-foreground">
          <p className="line-clamp-2 whitespace-pre-wrap">{update.body}</p>
        </td>
        <td className="px-3 py-2.5 align-top text-xs text-foreground">
          <p className="line-clamp-2 whitespace-pre-wrap">{update.internal_notes || <span className="text-muted-foreground">—</span>}</p>
        </td>
        <td className="px-3 py-2.5 align-top text-xs text-foreground">
          <p className="line-clamp-2 whitespace-pre-wrap">{update.action_items || <span className="text-muted-foreground">—</span>}</p>
        </td>
        <td className="px-3 py-2.5 align-top" onClick={(e) => e.stopPropagation()}>
          <div className="flex items-center justify-end gap-1">
            {/* Quick remark button */}
            <Button
              size="icon-sm"
              variant="ghost"
              aria-label="Add remark"
              title={update.comments.length > 0 ? `${update.comments.length} remark${update.comments.length !== 1 ? "s" : ""}` : "Add remark"}
              onClick={() => setExpanded(true)}
              className="relative"
            >
              <MessageCircle className="h-3.5 w-3.5 text-muted-foreground" />
              {update.comments.length > 0 && (
                <span className="absolute -top-1 -right-1 flex h-3.5 w-3.5 items-center justify-center rounded-full bg-primary text-[8px] font-bold text-primary-foreground">
                  {update.comments.length}
                </span>
              )}
            </Button>
            {update.attachments.length > 0 && (
              <span className="text-[10px] text-muted-foreground flex items-center gap-0.5">
                <Paperclip className="h-3 w-3" />{update.attachments.length}
              </span>
            )}
            {update.source === "email" && (
              <Mail className="h-3 w-3 text-blue-500" aria-label="Email source" />
            )}
            {!confirmDelete && (
              <Button size="icon-sm" variant="ghost" onClick={startEdit} aria-label="Edit">
                <Pencil className="h-3 w-3 text-muted-foreground" />
              </Button>
            )}
            {canDelete && !confirmDelete && (
              <Button size="icon-sm" variant="ghost" onClick={() => setConfirmDelete(true)} aria-label="Delete">
                <Trash2 className="h-3 w-3 text-destructive" />
              </Button>
            )}
            {confirmDelete && (
              <div className="flex items-center gap-1">
                <span className="text-[10px] text-muted-foreground">Delete?</span>
                <Button size="sm" variant="destructive" disabled={deleteUpdate.isPending}
                  onClick={() => deleteUpdate.mutate(update.id, { onError: () => toast.error("Failed to delete") })}>
                  {deleteUpdate.isPending ? "…" : "Yes"}
                </Button>
                <Button size="sm" variant="outline" onClick={() => setConfirmDelete(false)}>No</Button>
              </div>
            )}
          </div>
        </td>
      </tr>

      {/* Expanded detail row */}
      {expanded && (
        <tr className={`${rowBase} bg-muted/30`}>
          <td colSpan={8} className="px-4 py-4">
            {editing ? (
              <div className="space-y-3 max-w-4xl">
                {update.parent_update_id && parentSnippet && (
                  <div className="rounded-md border-l-2 border-primary bg-primary/5 px-3 py-2 text-xs text-muted-foreground">
                    <span className="font-medium text-primary">↩ Follow-up to: </span>{parentSnippet.slice(0, 100)}
                  </div>
                )}
                <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
                  <div className="space-y-1">
                    <Label className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">Date</Label>
                    <Input type="date" value={editDate} max={new Date().toISOString().slice(0, 10)} onChange={(e) => setEditDate(e.target.value)} className="w-40" />
                  </div>
                  {update.source === "email" && (
                    <>
                      <div className="space-y-1">
                        <Label className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">From</Label>
                        <Input value={editEmailFrom} onChange={(e) => setEditEmailFrom(e.target.value)} placeholder="sender@example.com" />
                      </div>
                      <div className="space-y-1">
                        <Label className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">Subject</Label>
                        <Input value={editEmailSubject} onChange={(e) => setEditEmailSubject(e.target.value)} placeholder="Subject…" />
                      </div>
                    </>
                  )}
                </div>
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                  <div className="space-y-1">
                    <Label className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">Current Capacities</Label>
                    <Textarea value={editCurrentCapacity} onChange={(e) => setEditCurrentCapacity(e.target.value)} className="min-h-[72px]" placeholder="Current capacities…" />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">Project Requirement</Label>
                    <Textarea value={editProjectRequirement} onChange={(e) => setEditProjectRequirement(e.target.value)} className="min-h-[72px]" placeholder="Project requirement…" />
                  </div>
                </div>
                <div className="space-y-1">
                  <Label className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">Update <span className="text-destructive">*</span></Label>
                  <Textarea value={editBody} onChange={(e) => setEditBody(e.target.value)} className="min-h-[90px]" />
                </div>
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                  <div className="space-y-1">
                    <Label className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">Comments</Label>
                    <Textarea value={editInternalNotes} onChange={(e) => setEditInternalNotes(e.target.value)} className="min-h-[72px]" placeholder="Comments…" />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">Remarks</Label>
                    <Textarea value={editActionItems} onChange={(e) => setEditActionItems(e.target.value)} className="min-h-[72px]" placeholder="Remarks…" />
                  </div>
                </div>
                <div className="flex gap-2 justify-end pt-1">
                  <Button size="sm" variant="outline" onClick={() => setEditing(false)}>Cancel</Button>
                  <Button size="sm" onClick={handleSave} disabled={editUpdate.isPending || !editBody.trim()}>
                    {editUpdate.isPending ? "Saving…" : "Save"}
                  </Button>
                </div>
              </div>
            ) : (
              <div className="space-y-3 max-w-4xl">
                {/* Follow-up banner */}
                {update.parent_update_id && parentSnippet && (
                  <div className="flex items-start gap-1.5 rounded-md bg-primary/5 px-3 py-1.5 text-xs text-muted-foreground border-l-2 border-primary">
                    <span className="shrink-0 font-medium text-primary">↩ Follow-up to:</span>
                    <span>{parentSnippet.slice(0, 120)}{parentSnippet.length > 120 ? "…" : ""}</span>
                  </div>
                )}

                {/* Posted by + email meta */}
                <div className="flex items-center gap-2 text-xs text-muted-foreground">
                  <Avatar className="h-5 w-5">
                    <AvatarFallback className="text-[8px] bg-primary/10 text-primary">
                      {(update.user_name || "?").slice(0, 2).toUpperCase()}
                    </AvatarFallback>
                  </Avatar>
                  <span>{update.user_name || "Unknown"}</span>
                  <span>·</span>
                  <span>{formatTimestamp(update.posted_at)}</span>
                  {update.source === "email" && update.email_from && (
                    <><span>·</span><span className="text-blue-600">From: {update.email_from}</span></>
                  )}
                </div>

                {/* Full text grid */}
                <div className="grid grid-cols-1 gap-x-6 gap-y-3 sm:grid-cols-2">
                  {update.current_capacity && (
                    <div>
                      <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground mb-1">Current Capacities</p>
                      <p className="whitespace-pre-wrap text-sm text-foreground">{update.current_capacity}</p>
                    </div>
                  )}
                  {update.project_requirement && (
                    <div>
                      <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground mb-1">Project Requirement</p>
                      <p className="whitespace-pre-wrap text-sm text-foreground">{update.project_requirement}</p>
                    </div>
                  )}
                  <div>
                    <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground mb-1">Update</p>
                    <p className="whitespace-pre-wrap text-sm text-foreground">{update.body}</p>
                  </div>
                  {update.internal_notes && (
                    <div>
                      <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground mb-1">Comments</p>
                      <p className="whitespace-pre-wrap text-sm text-foreground">{update.internal_notes}</p>
                    </div>
                  )}
                  {update.action_items && (
                    <div>
                      <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground mb-1">Remarks</p>
                      <p className="whitespace-pre-wrap text-sm text-foreground">{update.action_items}</p>
                    </div>
                  )}
                </div>

                {/* Attachments */}
                {update.attachments.length > 0 && (
                  <div className="space-y-1 pt-1 border-t border-border/50">
                    <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground mb-1">Attachments</p>
                    {update.attachments.map((att) => (
                      <div key={att.id} className="flex items-center gap-2 rounded-md border border-border px-3 py-1.5 text-xs bg-background">
                        <a href={api.projectUpdateAttachmentUrl(att.id)} target="_blank" rel="noopener noreferrer"
                          className="flex flex-1 min-w-0 items-center gap-2 text-foreground hover:underline">
                          <Download className="h-3 w-3 shrink-0 text-muted-foreground" />
                          <span className="truncate">{att.filename}</span>
                          {att.file_size && <span className="ml-auto shrink-0 text-muted-foreground">{formatBytes(att.file_size)}</span>}
                        </a>
                        {canDelete && (
                          confirmDeleteAttId === att.id ? (
                            <div className="flex items-center gap-1 shrink-0">
                              <span className="text-muted-foreground">Remove?</span>
                              <Button size="sm" variant="destructive" disabled={deleteAttachment.isPending}
                                onClick={() => deleteAttachment.mutate(att.id, {
                                  onSuccess: () => setConfirmDeleteAttId(null),
                                  onError: (err) => toast.error(err instanceof Error ? err.message : "Failed to delete attachment"),
                                })}>
                                {deleteAttachment.isPending ? "…" : "Yes"}
                              </Button>
                              <Button size="sm" variant="outline" onClick={() => setConfirmDeleteAttId(null)}>No</Button>
                            </div>
                          ) : (
                            <Button size="icon-sm" variant="ghost" className="shrink-0" onClick={() => setConfirmDeleteAttId(att.id)} aria-label="Delete attachment">
                              <Trash2 className="h-3 w-3 text-destructive" />
                            </Button>
                          )
                        )}
                      </div>
                    ))}
                  </div>
                )}

                {/* Remarks / comments — always visible */}
                <div className="pt-2 border-t border-border/50 space-y-2">
                  <p className="flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
                    <MessageCircle className="h-3.5 w-3.5" />
                    Remarks {update.comments.length > 0 && `(${update.comments.length})`}
                  </p>
                  {update.comments.map((c) => (
                    <div key={c.id} className="flex gap-2">
                      <Avatar className="h-5 w-5 shrink-0 mt-0.5">
                        <AvatarFallback className="text-[8px] bg-muted text-muted-foreground">
                          {(c.user_name || "?").slice(0, 2).toUpperCase()}
                        </AvatarFallback>
                      </Avatar>
                      <div className="min-w-0 flex-1 rounded-md bg-muted px-3 py-1.5">
                        <p className="text-[10px] font-medium text-foreground">{c.user_name || "Unknown"}</p>
                        <p className="text-xs text-foreground whitespace-pre-wrap">{c.body}</p>
                        <p className="text-[10px] text-muted-foreground mt-0.5">{formatTimestamp(c.created_at)}</p>
                      </div>
                    </div>
                  ))}
                  <div className="flex gap-2 items-start">
                    <Textarea
                      placeholder="Add a remark…"
                      value={commentBody}
                      onChange={(e) => setCommentBody(e.target.value)}
                      className="min-h-[60px] text-sm flex-1"
                      onKeyDown={(e) => {
                        if (e.key === "Enter" && (e.metaKey || e.ctrlKey) && commentBody.trim()) {
                          e.preventDefault();
                          addComment.mutate({ updateId: update.id, body: commentBody.trim() },
                            { onSuccess: () => setCommentBody(""), onError: () => toast.error("Failed to add remark") });
                        }
                      }}
                    />
                    <Button
                      size="icon-sm"
                      disabled={addComment.isPending || !commentBody.trim()}
                      onClick={() => addComment.mutate({ updateId: update.id, body: commentBody.trim() },
                        { onSuccess: () => setCommentBody(""), onError: () => toast.error("Failed to add remark") })}
                      className="mt-1 shrink-0"
                      aria-label="Post remark"
                    >
                      <Send className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                  <p className="text-[10px] text-muted-foreground">Ctrl+Enter to submit</p>
                </div>
              </div>
            )}
          </td>
        </tr>
      )}
    </>
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
