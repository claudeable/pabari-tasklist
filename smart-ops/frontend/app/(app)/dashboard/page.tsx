"use client";

import Link from "next/link";
import {
  HeartPulse,
  CalendarClock,
  ListChecks,
  Milestone as MilestoneIcon,
  Activity,
} from "lucide-react";
import { PageHeader } from "@/components/ui-custom/page-header";
import { StatusPill } from "@/components/ui-custom/status-pill";
import { ActivityRow, formatTimestamp } from "@/components/ui-custom/activity-row";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { useDashboardSummary } from "@/lib/hooks/use-dashboard";
import { useCurrentUser } from "@/lib/hooks/use-auth";

const CAN_SEE_ACTIVITY = new Set(["pmureithi@usm.co.ke", "hkotecha@kwale-group.com"]);

function canSeeActivity(user: { email?: string; role?: unknown } | undefined): boolean {
  if (!user) return false;
  if (user.email && CAN_SEE_ACTIVITY.has(user.email)) return true;
  if (typeof user.role === "string") return user.role.toLowerCase().includes("admin");
  return ((user.role as { name?: string })?.name ?? "").toLowerCase().includes("admin");
}

export default function DashboardPage() {
  const { data, isLoading, isError, refetch } = useDashboardSummary();
  const { data: currentUser } = useCurrentUser();
  const showActivity = canSeeActivity(currentUser);

  const s = data?.project_summary;
  const h = data?.project_health;
  const deadlines = data?.upcoming_deadlines ?? [];
  const milestones = data?.milestones ?? [];
  const openTasks = data?.open_tasks_count;
  const activity = data?.recent_activity ?? [];

  return (
    <div className="space-y-6">
      <PageHeader
        title="Dashboard"
        description="Overview of all projects and activity."
      />

      {/* Top row — 4 stat tiles */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <StatCard label="Total Projects" value={isLoading ? null : (s?.total ?? "—")} color="blue" />
        <StatCard label="Active" value={isLoading ? null : (s?.active ?? "—")} color="green" />
        <StatCard label="On Track" value={isLoading ? null : (h?.on_track ?? "—")} color="emerald" />
        <StatCard label="Open Tasks" value={isLoading ? null : (openTasks ?? "—")} color="amber" />
      </div>

      {/* Project Health bar */}
      <div className="rounded-xl border border-border bg-card p-4">
        <div className="mb-3 flex items-center gap-2">
          <HeartPulse className="h-4 w-4 text-primary" />
          <p className="text-sm font-semibold text-foreground">Project Health</p>
        </div>
        {isLoading ? (
          <Skeleton className="h-16 w-full rounded-lg" />
        ) : h ? (
          <div className="space-y-3">
            <HealthBar label="On Track" value={h.on_track ?? 0} total={(h.on_track ?? 0) + (h.at_risk ?? 0) + (h.off_track ?? 0)} tone="bg-emerald-500" />
            <HealthBar label="At Risk"  value={h.at_risk  ?? 0} total={(h.on_track ?? 0) + (h.at_risk ?? 0) + (h.off_track ?? 0)} tone="bg-amber-500" />
            <HealthBar label="Delayed"  value={h.off_track ?? 0} total={(h.on_track ?? 0) + (h.at_risk ?? 0) + (h.off_track ?? 0)} tone="bg-red-500" />
          </div>
        ) : (
          <p className="text-xs text-muted-foreground">No health data yet.</p>
        )}
      </div>

      {/* Second row — Deadlines + Milestones side by side */}
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        {/* Upcoming Deadlines */}
        <div className="rounded-xl border border-border bg-card p-4">
          <div className="mb-3 flex items-center gap-2">
            <CalendarClock className="h-4 w-4 text-primary" />
            <p className="text-sm font-semibold text-foreground">Upcoming Deadlines</p>
          </div>
          {isLoading ? (
            <div className="space-y-2">
              {[1,2,3].map(i => <Skeleton key={i} className="h-8 w-full rounded-md" />)}
            </div>
          ) : deadlines.length === 0 ? (
            <p className="text-xs text-muted-foreground">No upcoming deadlines.</p>
          ) : (
            <ul className="divide-y divide-border">
              {deadlines.slice(0, 5).map((item) => (
                <li key={item.id} className="flex items-center justify-between gap-2 py-2 text-sm">
                  <span className="truncate text-foreground">{item.title}</span>
                  <span className="shrink-0 text-xs text-muted-foreground">{formatTimestamp(item.due_date)}</span>
                </li>
              ))}
            </ul>
          )}
        </div>

        {/* Milestones */}
        <div className="rounded-xl border border-border bg-card p-4">
          <div className="mb-3 flex items-center gap-2">
            <MilestoneIcon className="h-4 w-4 text-primary" />
            <p className="text-sm font-semibold text-foreground">Project Milestones</p>
          </div>
          {isLoading ? (
            <div className="space-y-2">
              {[1,2,3].map(i => <Skeleton key={i} className="h-8 w-full rounded-md" />)}
            </div>
          ) : milestones.length === 0 ? (
            <p className="text-xs text-muted-foreground">No milestones yet.</p>
          ) : (
            <ul className="divide-y divide-border">
              {milestones.slice(0, 5).map((item) => (
                <li key={item.id} className="flex items-center justify-between gap-2 py-2 text-sm">
                  <div className="min-w-0">
                    <p className="truncate text-foreground">{item.title || item.name}</p>
                    {item.project_name && (
                      <p className="truncate text-xs text-muted-foreground">{item.project_name}</p>
                    )}
                  </div>
                  {item.status ? <StatusPill status={item.status} /> : null}
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>

      {/* Open Tasks quick link */}
      <div className="rounded-xl border border-border bg-card p-4 flex items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <ListChecks className="h-5 w-5 text-primary" />
          <div>
            <p className="text-sm font-semibold text-foreground">Open Tasks</p>
            <p className="text-xs text-muted-foreground">Tasks currently awaiting action</p>
          </div>
        </div>
        <div className="flex items-center gap-4">
          {isLoading ? (
            <Skeleton className="h-8 w-12 rounded-md" />
          ) : (
            <p className="text-3xl font-bold tabular-nums text-foreground">{openTasks ?? "—"}</p>
          )}
          <Button variant="outline" size="sm" asChild>
            <Link href="/tasks">View tasks →</Link>
          </Button>
        </div>
      </div>

      {/* Recent Activity — restricted */}
      {showActivity && (
        <div className="rounded-xl border border-border bg-card p-4">
          <div className="mb-3 flex items-center gap-2">
            <Activity className="h-4 w-4 text-primary" />
            <p className="text-sm font-semibold text-foreground">Recent Activity</p>
          </div>
          {isLoading ? (
            <div className="space-y-2">
              {[1,2,3,4].map(i => <Skeleton key={i} className="h-8 w-full rounded-md" />)}
            </div>
          ) : activity.length === 0 ? (
            <p className="text-xs text-muted-foreground">No recent activity.</p>
          ) : (
            <div className="divide-y divide-border">
              {activity.slice(0, 8).map((item) => (
                <ActivityRow key={item.id} item={item} />
              ))}
            </div>
          )}
          {isError && (
            <Button variant="ghost" size="sm" onClick={() => refetch()}>Retry</Button>
          )}
        </div>
      )}
    </div>
  );
}

function StatCard({ label, value, color }: { label: string; value: number | string | null; color: string }) {
  const colorMap: Record<string, string> = {
    blue: "bg-blue-50 text-blue-700 dark:bg-blue-950 dark:text-blue-300",
    green: "bg-green-50 text-green-700 dark:bg-green-950 dark:text-green-300",
    emerald: "bg-emerald-50 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300",
    amber: "bg-amber-50 text-amber-700 dark:bg-amber-950 dark:text-amber-300",
  };
  return (
    <div className={`rounded-xl p-4 ${colorMap[color] ?? colorMap.blue}`}>
      <p className="text-xs font-medium opacity-70">{label}</p>
      {value === null ? (
        <Skeleton className="mt-1 h-8 w-12 rounded-md" />
      ) : (
        <p className="mt-1 text-3xl font-bold tabular-nums">{value}</p>
      )}
    </div>
  );
}

function HealthBar({ label, value, total, tone }: { label: string; value: number; total: number; tone: string }) {
  const pct = total > 0 ? Math.round((value / total) * 100) : 0;
  return (
    <div className="flex items-center gap-3">
      <span className="w-20 shrink-0 text-xs text-muted-foreground">{label}</span>
      <div className="flex-1 h-2 overflow-hidden rounded-full bg-muted">
        <div className={`h-full rounded-full ${tone} transition-all`} style={{ width: `${pct}%` }} />
      </div>
      <span className="w-4 shrink-0 text-right text-xs font-medium text-foreground">{value}</span>
    </div>
  );
}
