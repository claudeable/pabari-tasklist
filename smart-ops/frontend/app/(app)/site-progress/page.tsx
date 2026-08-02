"use client";

import { useMemo, useState } from "react";
import { HardHat, Plus, CloudSun, MapPin, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { PageHeader } from "@/components/ui-custom/page-header";
import { EmptyState } from "@/components/ui-custom/empty-state";
import { ErrorState } from "@/components/ui-custom/error-state";
import { ConfirmDeleteDialog } from "@/components/ui-custom/confirm-delete-dialog";
import { formatTimestamp } from "@/components/ui-custom/activity-row";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
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
import { useProjects } from "@/lib/hooks/use-projects";
import {
  useCreateSiteReport,
  useDeleteSiteReport,
  useSiteReports,
} from "@/lib/hooks/use-site-progress";
import type { SiteReport } from "@/lib/types";

export default function SiteProgressPage() {
  const { data: projects } = useProjects();
  const [projectId, setProjectId] = useState<string>("");
  const { data, isLoading, isError, refetch } = useSiteReports(projectId || undefined);
  const [createOpen, setCreateOpen] = useState(false);
  const [pendingDelete, setPendingDelete] = useState<SiteReport | null>(null);
  const deleteSiteReport = useDeleteSiteReport();

  const reports = useMemo(() => {
    const list = data ?? [];
    return [...list].sort((a, b) => {
      const da = a.report_date ? new Date(a.report_date).getTime() : 0;
      const db = b.report_date ? new Date(b.report_date).getTime() : 0;
      return db - da;
    });
  }, [data]);

  function handleDelete() {
    if (!pendingDelete) return;
    deleteSiteReport.mutate(pendingDelete.id, {
      onSuccess: () => {
        toast.success("Report deleted");
        setPendingDelete(null);
      },
      onError: () => toast.error("Failed to delete report"),
    });
  }

  return (
    <div>
      <PageHeader
        title="Site Progress"
        description="On-the-ground progress reports, photos, and inspection records."
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
            <CreateSiteReportDialog
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
            <Skeleton key={i} className="h-28 rounded-xl" />
          ))}
        </div>
      ) : isError ? (
        <ErrorState onRetry={() => refetch()} />
      ) : reports.length === 0 ? (
        <EmptyState
          icon={HardHat}
          title="No site reports yet"
          description="Log a field report to track on-site progress."
          action={
            <Button size="sm" onClick={() => setCreateOpen(true)} className="gap-1.5">
              <Plus className="h-3.5 w-3.5" />
              New report
            </Button>
          }
        />
      ) : (
        <div className="space-y-3">
          {reports.map((report) => (
            <Card key={report.id} className="glass-panel">
              <CardContent className="space-y-2">
                <div className="flex items-center justify-between gap-2">
                  <p className="text-sm font-semibold text-foreground">
                    {report.report_date ? formatTimestamp(report.report_date) : "Report"}
                  </p>
                  <div className="flex shrink-0 items-center gap-2">
                    {typeof report.progress_percent === "number" ? (
                      <span className="text-xs font-medium text-primary">
                        {report.progress_percent}% complete
                      </span>
                    ) : null}
                    <Button
                      size="icon-sm"
                      variant="ghost"
                      aria-label="Delete report"
                      onClick={() => setPendingDelete(report)}
                    >
                      <Trash2 className="h-3.5 w-3.5 text-destructive" />
                    </Button>
                  </div>
                </div>
                {report.description ? (
                  <p className="text-sm text-muted-foreground">{report.description}</p>
                ) : null}
                <div className="flex flex-wrap items-center gap-3 text-xs text-muted-foreground">
                  {report.weather ? (
                    <span className="flex items-center gap-1">
                      <CloudSun className="h-3.5 w-3.5" />
                      {report.weather}
                    </span>
                  ) : null}
                  {report.gps_location ? (
                    <span className="flex items-center gap-1">
                      <MapPin className="h-3.5 w-3.5" />
                      {report.gps_location}
                    </span>
                  ) : null}
                </div>
                {report.photo_urls && report.photo_urls.length > 0 ? (
                  <div className="flex flex-wrap gap-2 pt-1">
                    {report.photo_urls.map((url, i) => (
                      <a
                        key={i}
                        href={url}
                        target="_blank"
                        rel="noreferrer"
                        className="text-xs text-primary underline underline-offset-2"
                      >
                        Photo {i + 1}
                      </a>
                    ))}
                  </div>
                ) : null}
              </CardContent>
            </Card>
          ))}
        </div>
      )}
      <ConfirmDeleteDialog
        open={Boolean(pendingDelete)}
        onOpenChange={(open) => !open && setPendingDelete(null)}
        title="Delete this report?"
        description="This can't be undone."
        isPending={deleteSiteReport.isPending}
        onConfirm={handleDelete}
      />
    </div>
  );
}

function CreateSiteReportDialog({
  open,
  onOpenChange,
  defaultProjectId,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  defaultProjectId?: string;
}) {
  const { data: projects } = useProjects();
  const createSiteReport = useCreateSiteReport();
  const [reportDate, setReportDate] = useState("");
  const [description, setDescription] = useState("");
  const [progress, setProgress] = useState("");
  const [weather, setWeather] = useState("");
  const [gps, setGps] = useState("");
  const [photoUrl, setPhotoUrl] = useState("");
  const [projectId, setProjectId] = useState(defaultProjectId || "");

  function reset() {
    setReportDate("");
    setDescription("");
    setProgress("");
    setWeather("");
    setGps("");
    setPhotoUrl("");
  }

  function handleSubmit() {
    if (!projectId) {
      toast.error("Project is required");
      return;
    }
    createSiteReport.mutate(
      {
        project_id: projectId,
        report_date: reportDate || undefined,
        description,
        progress_percent: progress ? Number(progress) : undefined,
        weather,
        gps_location: gps,
        photo_urls: photoUrl ? [photoUrl] : [],
      },
      {
        onSuccess: () => {
          toast.success("Site report submitted");
          reset();
          onOpenChange(false);
        },
        onError: () => toast.error("Failed to submit report"),
      },
    );
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogTrigger asChild>
        <Button size="sm" className="gap-1.5">
          <Plus className="h-3.5 w-3.5" />
          New report
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>New site report</DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          <div className="space-y-1.5">
            <Label htmlFor="site-project">Project</Label>
            <Select value={projectId} onValueChange={setProjectId}>
              <SelectTrigger id="site-project" className="w-full">
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
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="site-date">Report date</Label>
              <Input
                id="site-date"
                type="date"
                value={reportDate}
                onChange={(e) => setReportDate(e.target.value)}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="site-progress">Progress %</Label>
              <Input
                id="site-progress"
                type="number"
                min={0}
                max={100}
                value={progress}
                onChange={(e) => setProgress(e.target.value)}
              />
            </div>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="site-description">Description</Label>
            <Textarea
              id="site-description"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="site-weather">Weather</Label>
              <Input id="site-weather" value={weather} onChange={(e) => setWeather(e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="site-gps">GPS location</Label>
              <Input id="site-gps" value={gps} onChange={(e) => setGps(e.target.value)} />
            </div>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="site-photo-url">Photo URL</Label>
            <Input
              id="site-photo-url"
              placeholder="https://…"
              value={photoUrl}
              onChange={(e) => setPhotoUrl(e.target.value)}
            />
          </div>
        </div>
        <DialogFooter>
          <Button onClick={handleSubmit} disabled={createSiteReport.isPending}>
            Submit
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
