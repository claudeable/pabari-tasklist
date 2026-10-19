"use client";

import { useRef, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Download, Printer, RefreshCw } from "lucide-react";
import { toast } from "sonner";
import { api } from "@/lib/api-client";
import { reportDate, reportPrintStyles } from "@/lib/project-report";
import { useProjects } from "@/lib/hooks/use-projects";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ErrorState } from "@/components/ui-custom/error-state";
import { Skeleton } from "@/components/ui/skeleton";

const selectClass = "h-9 w-full rounded-md border border-input bg-background px-3 text-sm";

export function ProjectUpdatesReportPanel() {
  const { data: projects, isError: projectsError, refetch: retryProjects } = useProjects();
  const [projectId, setProjectId] = useState("");
  const [start, setStart] = useState("");
  const [end, setEnd] = useState("");
  const [status, setStatus] = useState("");
  const [query, setQuery] = useState("");
  const [exporting, setExporting] = useState(false);
  const reportRef = useRef<HTMLDivElement>(null);
  const report = useQuery({ queryKey: ["reports", "project-updates", query], queryFn: () => api.projectUpdatesReport(query) });

  function generate() {
    if (start && end && start > end) { toast.error("Start date must be on or before end date"); return; }
    const params = new URLSearchParams();
    if (projectId) params.set("project_id", projectId);
    if (start) params.set("start_date", start);
    if (end) params.set("end_date", end);
    if (status) params.set("status", status);
    if (params.toString() === query) void report.refetch();
    else setQuery(params.toString());
  }

  async function excel() {
    setExporting(true);
    try {
      const blob = await api.exportProjectUpdatesReport(query);
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url; link.download = "smart-ops-project-updates.xlsx"; link.click();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
    } catch (error) { toast.error(error instanceof Error ? error.message : "Excel export failed"); }
    finally { setExporting(false); }
  }

  function print() {
    if (!reportRef.current) return;
    const popup = window.open("", "_blank");
    if (!popup) { toast.error("Allow pop-ups to open the printable report"); return; }
    popup.document.write(`<!doctype html><html><head><title>Smart Ops project updates</title><style>${reportPrintStyles}</style></head><body>${reportRef.current.innerHTML}</body></html>`);
    popup.document.close();
    popup.focus();
    popup.print();
  }

  return <div className="space-y-5">
    <div className="rounded-xl border border-border bg-card p-4 space-y-4">
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <div className="space-y-1"><Label htmlFor="report-project">Project</Label><select id="report-project" className={selectClass} value={projectId} onChange={e => setProjectId(e.target.value)}><option value="">All projects</option>{projects?.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}</select></div>
        <div className="space-y-1"><Label htmlFor="report-start">From date</Label><Input id="report-start" type="date" value={start} onChange={e => setStart(e.target.value)} /></div>
        <div className="space-y-1"><Label htmlFor="report-end">To date</Label><Input id="report-end" type="date" value={end} onChange={e => setEnd(e.target.value)} /></div>
        <div className="space-y-1"><Label htmlFor="report-status">Update status</Label><select id="report-status" className={selectClass} value={status} onChange={e => setStatus(e.target.value)}><option value="">All statuses</option><option value="open">Open</option><option value="in_progress">In progress</option><option value="done">Done</option></select></div>
      </div>
      {projectsError && <p className="text-sm text-destructive">Project choices could not load. <button className="underline" onClick={() => void retryProjects()}>Retry</button></p>}
      <div className="flex flex-wrap items-center gap-2">
        <Button onClick={generate} disabled={report.isFetching}><RefreshCw className="h-4 w-4" />{report.isFetching ? "Generating…" : "Generate report"}</Button>
        <Button variant="outline" onClick={print} disabled={!report.data || report.isError || report.isFetching}><Printer className="h-4 w-4" />Print / Save PDF</Button>
        <Button variant="outline" onClick={() => void excel()} disabled={!report.data || report.isError || report.isFetching || exporting}><Download className="h-4 w-4" />{exporting ? "Exporting…" : "Download Excel"}</Button>
      </div>
      <p className="text-xs text-muted-foreground">Date filters use the update date in Nairobi time. Generate after changing filters. To create a PDF, choose “Save as PDF” in the print dialog.</p>
    </div>
    {report.isPending ? <Skeleton className="h-60 w-full" /> : report.isError ? <ErrorState onRetry={() => void report.refetch()} /> : report.data && <div ref={reportRef} className="rounded-xl border border-border bg-card p-4 sm:p-6">
      <h1 className="text-2xl font-bold">Smart Ops · Project updates</h1>
      <div className="report-meta text-sm text-muted-foreground mt-2 mb-6">
        <p>Generated {reportDate(report.data.generated_at)} · {report.data.projects.length} projects · {report.data.update_count} updates</p>
        <p>Period: {report.data.start_date || "Beginning"} to {report.data.end_date || "Present"} · Status: {report.data.status?.replaceAll("_", " ") || "All statuses"} · Dates: Africa/Nairobi</p>
      </div>
      {!report.data.projects.length && <p>No projects available.</p>}
      {report.data.projects.map(project => <section key={project.id} className="report-section mb-8 last:mb-0">
        <div className="report-project-heading mb-3"><h2 className="text-lg font-semibold">{project.name}</h2><p className="text-sm text-muted-foreground">{project.status.replaceAll("_", " ")} · {project.updates.length} updates</p></div>
        {!project.updates.length ? <p className="text-sm text-muted-foreground">No updates match these filters.</p> : <div className="overflow-x-auto"><table className="w-full min-w-[900px] table-fixed border-collapse text-xs">
          <thead><tr>{["Date / author", "Status", "Current capacities / requirement", "Update", "Comments", "Remarks"].map(heading => <th key={heading} className="border border-border bg-muted p-3 text-left font-semibold">{heading}</th>)}</tr></thead>
          <tbody>{project.updates.map(update => <tr key={update.id}>
            <td className="border border-border p-3 align-top break-words"><p>{reportDate(update.posted_at)}</p><p className="mt-1 text-muted-foreground">{update.author}</p></td>
            <td className="border border-border p-3 align-top">{update.status.replaceAll("_", " ")}</td>
            <td className="border border-border p-3 align-top whitespace-pre-wrap break-words"><strong>Current capacities</strong><p>{update.current_capacity || "—"}</p><strong className="mt-3 block">Requirement</strong><p>{update.project_requirement || "—"}</p></td>
            <td className="border border-border p-3 align-top whitespace-pre-wrap break-words">{update.body}</td>
            <td className="border border-border p-3 align-top whitespace-pre-wrap break-words">{update.internal_notes && <p>{update.internal_notes}</p>}{update.comments.map((comment, index) => <div key={index} className="report-comment mt-2 border-t border-border pt-2"><strong>{comment.author}</strong><p className="text-muted-foreground">{reportDate(comment.created_at)}</p><p>{comment.body}</p></div>)}{!update.internal_notes && !update.comments.length && "—"}</td>
            <td className="border border-border p-3 align-top whitespace-pre-wrap break-words">{update.action_items || "—"}</td>
          </tr>)}</tbody>
        </table></div>}
      </section>)}
    </div>}
  </div>;
}
