"use client";

import { useMemo, useState } from "react";
import { CalendarClock, Plus } from "lucide-react";
import { toast } from "sonner";
import { PageHeader } from "@/components/ui-custom/page-header";
import { EmptyState } from "@/components/ui-custom/empty-state";
import { ErrorState } from "@/components/ui-custom/error-state";
import { StatusPill } from "@/components/ui-custom/status-pill";
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
import { useProjects } from "@/lib/hooks/use-projects";
import { useCreateMeeting, useMeetings } from "@/lib/hooks/use-meetings";

const STATUS_OPTIONS = ["scheduled", "in_progress", "completed", "cancelled"];

export default function MeetingsPage() {
  const { data: projects } = useProjects();
  const [projectId, setProjectId] = useState<string>("");
  const { data, isLoading, isError, refetch } = useMeetings(projectId || undefined);
  const [createOpen, setCreateOpen] = useState(false);

  const meetings = useMemo(() => {
    const list = data ?? [];
    return [...list].sort((a, b) => {
      const da = a.scheduled_at ? new Date(a.scheduled_at).getTime() : 0;
      const db = b.scheduled_at ? new Date(b.scheduled_at).getTime() : 0;
      return da - db;
    });
  }, [data]);

  return (
    <div>
      <PageHeader
        title="Meetings"
        description="Schedule, run, and document joint meetings."
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
            <CreateMeetingDialog
              open={createOpen}
              onOpenChange={setCreateOpen}
              defaultProjectId={projectId}
            />
          </div>
        }
      />

      {isLoading ? (
        <div className="space-y-3">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-20 rounded-xl" />
          ))}
        </div>
      ) : isError ? (
        <ErrorState onRetry={() => refetch()} />
      ) : meetings.length === 0 ? (
        <EmptyState
          icon={CalendarClock}
          title="No meetings scheduled"
          description="Create a meeting to coordinate with the other organization."
          action={
            <Button size="sm" onClick={() => setCreateOpen(true)} className="gap-1.5">
              <Plus className="h-3.5 w-3.5" />
              New meeting
            </Button>
          }
        />
      ) : (
        <div className="space-y-3">
          {meetings.map((meeting) => (
            <Card key={meeting.id} className="glass-panel">
              <CardContent className="flex items-center justify-between gap-4">
                <div className="min-w-0">
                  <p className="truncate text-sm font-semibold text-foreground">
                    {meeting.title}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {meeting.scheduled_at ? formatTimestamp(meeting.scheduled_at) : "Unscheduled"}
                  </p>
                </div>
                {meeting.status ? <StatusPill status={meeting.status} /> : null}
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}

function CreateMeetingDialog({
  open,
  onOpenChange,
  defaultProjectId,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  defaultProjectId?: string;
}) {
  const { data: projects } = useProjects();
  const createMeeting = useCreateMeeting();
  const [title, setTitle] = useState("");
  const [scheduledAt, setScheduledAt] = useState("");
  const [status, setStatus] = useState("scheduled");
  const [projectId, setProjectId] = useState(defaultProjectId || "");

  function reset() {
    setTitle("");
    setScheduledAt("");
    setStatus("scheduled");
  }

  function handleSubmit() {
    if (!title.trim() || !projectId) {
      toast.error("Title and project are required");
      return;
    }
    createMeeting.mutate(
      {
        title,
        scheduled_at: scheduledAt ? new Date(scheduledAt).toISOString() : undefined,
        status,
        project_id: projectId,
      },
      {
        onSuccess: () => {
          toast.success("Meeting created");
          reset();
          onOpenChange(false);
        },
        onError: () => toast.error("Failed to create meeting"),
      },
    );
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogTrigger asChild>
        <Button size="sm" className="gap-1.5">
          <Plus className="h-3.5 w-3.5" />
          New meeting
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>New meeting</DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          <div className="space-y-1.5">
            <Label htmlFor="meeting-project">Project</Label>
            <Select value={projectId} onValueChange={setProjectId}>
              <SelectTrigger id="meeting-project" className="w-full">
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
            <Label htmlFor="meeting-title">Title</Label>
            <Input id="meeting-title" value={title} onChange={(e) => setTitle(e.target.value)} />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="meeting-scheduled-at">Scheduled at</Label>
            <Input
              id="meeting-scheduled-at"
              type="datetime-local"
              value={scheduledAt}
              onChange={(e) => setScheduledAt(e.target.value)}
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="meeting-status">Status</Label>
            <Select value={status} onValueChange={setStatus}>
              <SelectTrigger id="meeting-status" className="w-full">
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
          <Button onClick={handleSubmit} disabled={createMeeting.isPending}>
            Create
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
