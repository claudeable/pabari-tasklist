"use client";

import Link from "next/link";
import {
  FolderKanban,
  HeartPulse,
  Activity,
  CalendarClock,
  ClipboardCheck,
  ListChecks,
  FileText,
  MessagesSquare,
  Milestone as MilestoneIcon,
  Zap,
} from "lucide-react";
import { WidgetCard } from "@/components/ui-custom/widget-card";
import { StatTile } from "@/components/ui-custom/stat-tile";
import { StatusPill } from "@/components/ui-custom/status-pill";
import { ActivityRow, formatTimestamp } from "@/components/ui-custom/activity-row";
import { Button } from "@/components/ui/button";
import type { DashboardSummary } from "@/lib/types";

interface WidgetProps {
  summary: DashboardSummary | undefined;
  isLoading: boolean;
  isError: boolean;
  onRetry: () => void;
}

export function ProjectSummaryWidget({ summary, isLoading, isError, onRetry }: WidgetProps) {
  const s = summary?.project_summary;
  const isEmpty = !isLoading && !isError && !s;
  return (
    <WidgetCard
      id="project_summary"
      title="Project Summary"
      icon={<FolderKanban className="h-4 w-4 text-primary" />}
      isLoading={isLoading}
      isError={isError}
      onRetry={onRetry}
      isEmpty={isEmpty}
      emptyDescription="No project summary data available yet."
    >
      {s && (
        <div className="grid grid-cols-2 gap-2">
          <StatTile label="Total" value={s.total ?? "—"} />
          <StatTile label="Active" value={s.active ?? "—"} />
          <StatTile label="Completed" value={s.completed ?? "—"} />
          <StatTile label="On Hold" value={s.on_hold ?? "—"} />
        </div>
      )}
    </WidgetCard>
  );
}

export function ProjectHealthWidget({ summary, isLoading, isError, onRetry }: WidgetProps) {
  const h = summary?.project_health;
  const isEmpty = !isLoading && !isError && !h;
  return (
    <WidgetCard
      id="project_health"
      title="Project Health"
      icon={<HeartPulse className="h-4 w-4 text-primary" />}
      isLoading={isLoading}
      isError={isError}
      onRetry={onRetry}
      isEmpty={isEmpty}
      emptyDescription="No health indicators reported yet."
    >
      {h && (
        <div className="space-y-3">
          <HealthBar label="On Track" value={h.on_track ?? 0} tone="bg-emerald-500" />
          <HealthBar label="At Risk" value={h.at_risk ?? 0} tone="bg-amber-500" />
          <HealthBar label="Off Track" value={h.off_track ?? 0} tone="bg-red-500" />
        </div>
      )}
    </WidgetCard>
  );
}

function HealthBar({ label, value, tone }: { label: string; value: number; tone: string }) {
  return (
    <div>
      <div className="mb-1 flex items-center justify-between text-xs">
        <span className="text-muted-foreground">{label}</span>
        <span className="font-medium text-foreground">{value}</span>
      </div>
      <div className="h-1.5 w-full overflow-hidden rounded-full bg-muted">
        <div
          className={`h-full rounded-full ${tone}`}
          style={{ width: `${Math.min(value * 10, 100)}%` }}
        />
      </div>
    </div>
  );
}

export function RecentActivityWidget({ summary, isLoading, isError, onRetry }: WidgetProps) {
  const items = summary?.recent_activity ?? [];
  return (
    <WidgetCard
      id="recent_activity"
      title="Recent Activity"
      icon={<Activity className="h-4 w-4 text-primary" />}
      isLoading={isLoading}
      isError={isError}
      onRetry={onRetry}
      isEmpty={!isLoading && !isError && items.length === 0}
      emptyDescription="Activity from both organizations will show up here."
    >
      <div className="divide-y divide-border">
        {items.slice(0, 6).map((item) => (
          <ActivityRow key={item.id} item={item} />
        ))}
      </div>
    </WidgetCard>
  );
}

export function UpcomingDeadlinesWidget({ summary, isLoading, isError, onRetry }: WidgetProps) {
  const items = summary?.upcoming_deadlines ?? [];
  return (
    <WidgetCard
      id="upcoming_deadlines"
      title="Upcoming Deadlines"
      icon={<CalendarClock className="h-4 w-4 text-primary" />}
      isLoading={isLoading}
      isError={isError}
      onRetry={onRetry}
      isEmpty={!isLoading && !isError && items.length === 0}
      emptyDescription="No upcoming deadlines in the next period."
    >
      <ul className="space-y-2.5">
        {items.slice(0, 6).map((item) => (
          <li key={item.id} className="flex items-center justify-between gap-2 text-sm">
            <span className="truncate text-foreground">{item.title}</span>
            <span className="shrink-0 text-xs text-muted-foreground">
              {formatTimestamp(item.due_date)}
            </span>
          </li>
        ))}
      </ul>
    </WidgetCard>
  );
}

export function PendingApprovalsWidget({ summary, isLoading, isError, onRetry }: WidgetProps) {
  const items = summary?.pending_approvals ?? [];
  return (
    <WidgetCard
      id="pending_approvals"
      title="Pending Approvals"
      icon={<ClipboardCheck className="h-4 w-4 text-primary" />}
      isLoading={isLoading}
      isError={isError}
      onRetry={onRetry}
      isEmpty={!isLoading && !isError && items.length === 0}
      emptyDescription="Nothing is waiting on your approval."
    >
      <ul className="space-y-2.5">
        {items.slice(0, 6).map((item) => (
          <li key={item.id} className="flex items-center justify-between gap-2 text-sm">
            <div className="min-w-0">
              <p className="truncate text-foreground">{item.title}</p>
              {item.requested_by ? (
                <p className="truncate text-xs text-muted-foreground">
                  by {item.requested_by}
                </p>
              ) : null}
            </div>
            <StatusPill status="pending" />
          </li>
        ))}
      </ul>
    </WidgetCard>
  );
}

export function OpenTasksWidget({ summary, isLoading, isError, onRetry }: WidgetProps) {
  const count = summary?.open_tasks_count;
  return (
    <WidgetCard
      id="open_tasks"
      title="Open Tasks"
      icon={<ListChecks className="h-4 w-4 text-primary" />}
      isLoading={isLoading}
      isError={isError}
      onRetry={onRetry}
      isEmpty={!isLoading && !isError && (count === undefined || count === null)}
      emptyDescription="No open task data available."
    >
      <div className="flex items-center gap-4">
        <p className="text-4xl font-semibold tabular-nums text-foreground">{count}</p>
        <div>
          <p className="text-sm text-foreground">Tasks awaiting action</p>
          <Button variant="link" size="sm" asChild className="h-auto px-0 text-primary">
            <Link href="/tasks">View all tasks →</Link>
          </Button>
        </div>
      </div>
    </WidgetCard>
  );
}

export function RecentDocumentsWidget({ summary, isLoading, isError, onRetry }: WidgetProps) {
  const items = summary?.recent_documents ?? [];
  return (
    <WidgetCard
      id="recent_documents"
      title="Recent Documents"
      icon={<FileText className="h-4 w-4 text-primary" />}
      isLoading={isLoading}
      isError={isError}
      onRetry={onRetry}
      isEmpty={!isLoading && !isError && items.length === 0}
      emptyDescription="Shared documents will appear here."
    >
      <ul className="space-y-2.5">
        {items.slice(0, 6).map((item) => (
          <li key={item.id} className="flex items-center justify-between gap-2 text-sm">
            <span className="truncate text-foreground">{item.name || item.title}</span>
            <span className="shrink-0 text-xs text-muted-foreground">
              {formatTimestamp(item.updated_at)}
            </span>
          </li>
        ))}
      </ul>
    </WidgetCard>
  );
}

export function UnreadMessagesWidget({ summary, isLoading, isError, onRetry }: WidgetProps) {
  const count = summary?.unread_messages_count;
  return (
    <WidgetCard
      id="unread_messages"
      title="Unread Messages"
      icon={<MessagesSquare className="h-4 w-4 text-primary" />}
      isLoading={isLoading}
      isError={isError}
      onRetry={onRetry}
      isEmpty={!isLoading && !isError && (count === undefined || count === null)}
      emptyDescription="No messaging data available."
    >
      <div className="flex items-center gap-4">
        <p className="text-4xl font-semibold tabular-nums text-foreground">{count}</p>
        <div>
          <p className="text-sm text-foreground">Waiting in your inbox</p>
          <Button variant="link" size="sm" asChild className="h-auto px-0 text-primary">
            <Link href="/communication">Open Communication →</Link>
          </Button>
        </div>
      </div>
    </WidgetCard>
  );
}

export function MilestonesWidget({ summary, isLoading, isError, onRetry }: WidgetProps) {
  const items = summary?.milestones ?? [];
  return (
    <WidgetCard
      id="milestones"
      title="Project Milestones"
      icon={<MilestoneIcon className="h-4 w-4 text-primary" />}
      isLoading={isLoading}
      isError={isError}
      onRetry={onRetry}
      isEmpty={!isLoading && !isError && items.length === 0}
      emptyDescription="No milestones scheduled yet."
    >
      <ul className="space-y-2.5">
        {items.slice(0, 6).map((item) => (
          <li key={item.id} className="flex items-center justify-between gap-2 text-sm">
            <div className="min-w-0">
              <p className="truncate text-foreground">{item.title || item.name}</p>
              {item.project_name ? (
                <p className="truncate text-xs text-muted-foreground">{item.project_name}</p>
              ) : null}
            </div>
            {item.status ? <StatusPill status={item.status} /> : null}
          </li>
        ))}
      </ul>
    </WidgetCard>
  );
}

export function QuickActionsWidget({ summary, isLoading, isError, onRetry }: WidgetProps) {
  const items = summary?.quick_actions ?? [];
  return (
    <WidgetCard
      id="quick_actions"
      title="Quick Actions"
      icon={<Zap className="h-4 w-4 text-primary" />}
      isLoading={isLoading}
      isError={isError}
      onRetry={onRetry}
      isEmpty={!isLoading && !isError && items.length === 0}
      emptyDescription="Quick actions will appear here."
    >
      <div className="flex flex-wrap gap-2">
        {items.slice(0, 8).map((action) => (
          <Button key={action.id} variant="outline" size="sm" asChild>
            <Link href={action.href || "#"}>{action.label}</Link>
          </Button>
        ))}
      </div>
    </WidgetCard>
  );
}

export const WIDGET_REGISTRY: Record<
  string,
  { title: string; Component: (props: WidgetProps) => React.ReactElement }
> = {
  project_summary: { title: "Project Summary", Component: ProjectSummaryWidget },
  project_health: { title: "Project Health", Component: ProjectHealthWidget },
  recent_activity: { title: "Recent Activity", Component: RecentActivityWidget },
  upcoming_deadlines: { title: "Upcoming Deadlines", Component: UpcomingDeadlinesWidget },
  pending_approvals: { title: "Pending Approvals", Component: PendingApprovalsWidget },
  open_tasks: { title: "Open Tasks", Component: OpenTasksWidget },
  recent_documents: { title: "Recent Documents", Component: RecentDocumentsWidget },
  unread_messages: { title: "Unread Messages", Component: UnreadMessagesWidget },
  milestones: { title: "Project Milestones", Component: MilestonesWidget },
  quick_actions: { title: "Quick Actions", Component: QuickActionsWidget },
};

export const DEFAULT_WIDGET_ORDER = Object.keys(WIDGET_REGISTRY);
