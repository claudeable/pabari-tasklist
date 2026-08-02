"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { FolderKanban, LayoutGrid, TableIcon, Calendar, Plus } from "lucide-react";
import { toast } from "sonner";
import { PageHeader } from "@/components/ui-custom/page-header";
import { EmptyState } from "@/components/ui-custom/empty-state";
import { ErrorState } from "@/components/ui-custom/error-state";
import { StatusPill } from "@/components/ui-custom/status-pill";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
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
import { useCreateProject, useProjects } from "@/lib/hooks/use-projects";
import type { ProjectHealth, ProjectStatus } from "@/lib/types";
import { cn } from "@/lib/utils";

type ViewMode = "card" | "table";

const STATUS_OPTIONS: ProjectStatus[] = [
  "planning",
  "active",
  "on_hold",
  "completed",
  "cancelled",
];
const HEALTH_OPTIONS: ProjectHealth[] = ["on_track", "at_risk", "delayed"];

export default function ProjectsPage() {
  const { data, isLoading, isError, refetch } = useProjects();
  const [view, setView] = useState<ViewMode>("card");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [createOpen, setCreateOpen] = useState(false);

  const projects = useMemo(() => data ?? [], [data]);

  const statuses = useMemo(() => {
    const set = new Set<string>();
    projects.forEach((p) => p.status && set.add(p.status));
    return Array.from(set);
  }, [projects]);

  const filtered = useMemo(() => {
    if (statusFilter === "all") return projects;
    return projects.filter((p) => p.status === statusFilter);
  }, [projects, statusFilter]);

  return (
    <div>
      <PageHeader
        title="Projects"
        description="Joint infrastructure projects across all participating organizations."
        actions={
          <div className="flex items-center gap-2">
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-40">
                <SelectValue placeholder="All statuses" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All statuses</SelectItem>
                {statuses.map((s) => (
                  <SelectItem key={s} value={s}>
                    {s.replace(/_/g, " ")}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <div className="flex items-center rounded-md border border-border p-0.5">
              <Button
                variant={view === "card" ? "secondary" : "ghost"}
                size="icon-sm"
                aria-label="Card view"
                onClick={() => setView("card")}
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
            <CreateProjectDialog open={createOpen} onOpenChange={setCreateOpen} />
          </div>
        }
      />

      {isLoading ? (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 6 }).map((_, i) => (
            <Skeleton key={i} className="h-40 rounded-xl" />
          ))}
        </div>
      ) : isError ? (
        <ErrorState onRetry={() => refetch()} />
      ) : filtered.length === 0 ? (
        <EmptyState
          icon={FolderKanban}
          title="No projects found"
          description="Try a different status filter, or create a new project to get started."
          action={
            <Button size="sm" onClick={() => setCreateOpen(true)} className="gap-1.5">
              <Plus className="h-3.5 w-3.5" />
              New project
            </Button>
          }
        />
      ) : view === "card" ? (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {filtered.map((project) => (
            <Link key={project.id} href={`/projects/${project.id}`}>
              <Card className="glass-panel h-full transition-shadow hover:shadow-md">
                <CardHeader className="space-y-0">
                  <div className="flex items-start justify-between gap-2">
                    <p className="font-semibold text-foreground">{project.name}</p>
                    {project.status ? <StatusPill status={project.status} /> : null}
                  </div>
                </CardHeader>
                <CardContent className="space-y-3">
                  <p className="line-clamp-2 text-xs text-muted-foreground">
                    {project.description || "No description provided."}
                  </p>
                  <div className="flex items-center justify-between text-xs">
                    {project.health ? (
                      <StatusPill status={project.health} />
                    ) : (
                      <span className="text-muted-foreground">Health: —</span>
                    )}
                    {project.end_date ? (
                      <span className="flex items-center gap-1 text-muted-foreground">
                        <Calendar className="h-3 w-3" />
                        {project.end_date}
                      </span>
                    ) : null}
                  </div>
                  {typeof project.progress === "number" ? (
                    <div className="h-1.5 w-full overflow-hidden rounded-full bg-muted">
                      <div
                        className="h-full rounded-full bg-primary"
                        style={{ width: `${Math.min(project.progress, 100)}%` }}
                      />
                    </div>
                  ) : null}
                </CardContent>
              </Card>
            </Link>
          ))}
        </div>
      ) : (
        <div className={cn("overflow-hidden rounded-xl border border-border")}>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Project</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Health</TableHead>
                <TableHead>Progress</TableHead>
                <TableHead>End Date</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.map((project) => (
                <TableRow key={project.id} className="cursor-pointer">
                  <TableCell>
                    <Link href={`/projects/${project.id}`} className="font-medium text-foreground">
                      {project.name}
                    </Link>
                  </TableCell>
                  <TableCell>
                    {project.status ? <StatusPill status={project.status} /> : "—"}
                  </TableCell>
                  <TableCell>
                    {project.health ? <StatusPill status={project.health} /> : "—"}
                  </TableCell>
                  <TableCell>
                    {typeof project.progress === "number" ? `${project.progress}%` : "—"}
                  </TableCell>
                  <TableCell>{project.end_date || "—"}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}
    </div>
  );
}

function CreateProjectDialog({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const router = useRouter();
  const createProject = useCreateProject();
  const [name, setName] = useState("");
  const [code, setCode] = useState("");
  const [description, setDescription] = useState("");
  const [status, setStatus] = useState<ProjectStatus>("planning");
  const [health, setHealth] = useState<ProjectHealth>("on_track");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [budgetAmount, setBudgetAmount] = useState("");
  const [budgetCurrency, setBudgetCurrency] = useState("USD");

  function reset() {
    setName("");
    setCode("");
    setDescription("");
    setStatus("planning");
    setHealth("on_track");
    setStartDate("");
    setEndDate("");
    setBudgetAmount("");
    setBudgetCurrency("USD");
  }

  function handleSubmit() {
    if (!name.trim()) {
      toast.error("Name is required");
      return;
    }
    createProject.mutate(
      {
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
      {
        onSuccess: (project) => {
          toast.success("Project created");
          reset();
          onOpenChange(false);
          if (project?.id) {
            router.push(`/projects/${project.id}`);
          }
        },
        onError: () => toast.error("Failed to create project"),
      },
    );
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogTrigger asChild>
        <Button size="sm" className="gap-1.5">
          <Plus className="h-3.5 w-3.5" />
          New project
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>New project</DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="new-project-name">Name</Label>
              <Input
                id="new-project-name"
                value={name}
                onChange={(e) => setName(e.target.value)}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="new-project-code">Code</Label>
              <Input
                id="new-project-code"
                value={code}
                onChange={(e) => setCode(e.target.value)}
              />
            </div>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="new-project-description">Description</Label>
            <Textarea
              id="new-project-description"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="new-project-status">Status</Label>
              <Select value={status} onValueChange={(v) => setStatus(v as ProjectStatus)}>
                <SelectTrigger id="new-project-status" className="w-full">
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
              <Label htmlFor="new-project-health">Health</Label>
              <Select value={health} onValueChange={(v) => setHealth(v as ProjectHealth)}>
                <SelectTrigger id="new-project-health" className="w-full">
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
              <Label htmlFor="new-project-start-date">Start date</Label>
              <Input
                id="new-project-start-date"
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="new-project-end-date">End date</Label>
              <Input
                id="new-project-end-date"
                type="date"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
              />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="new-project-budget-amount">Budget amount</Label>
              <Input
                id="new-project-budget-amount"
                type="number"
                value={budgetAmount}
                onChange={(e) => setBudgetAmount(e.target.value)}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="new-project-budget-currency">Budget currency</Label>
              <Input
                id="new-project-budget-currency"
                value={budgetCurrency}
                onChange={(e) => setBudgetCurrency(e.target.value)}
              />
            </div>
          </div>
        </div>
        <DialogFooter>
          <Button onClick={handleSubmit} disabled={createProject.isPending}>
            Create
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
