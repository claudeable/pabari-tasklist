"use client";

import { BarChart3 } from "lucide-react";
import { PageHeader } from "@/components/ui-custom/page-header";
import { EmptyState } from "@/components/ui-custom/empty-state";
import { ErrorState } from "@/components/ui-custom/error-state";
import { StatTile } from "@/components/ui-custom/stat-tile";
import { ActivityRow } from "@/components/ui-custom/activity-row";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import type { ActivityItem } from "@/lib/types";
import {
  useActivityReport,
  useProjectProgressReport,
  useRisksSummaryReport,
  useTasksSummaryReport,
} from "@/lib/hooks/use-reports";

export default function ReportsPage() {
  return (
    <div>
      <PageHeader
        title="Reports"
        description="Cross-module reports for stakeholders across both organizations."
      />

      <Tabs defaultValue="progress">
        <TabsList className="mb-4 flex-wrap">
          <TabsTrigger value="progress">Project Progress</TabsTrigger>
          <TabsTrigger value="tasks">Tasks Summary</TabsTrigger>
          <TabsTrigger value="risks">Risks Summary</TabsTrigger>
          <TabsTrigger value="activity">Activity</TabsTrigger>
        </TabsList>

        <TabsContent value="progress">
          <ReportSection useReport={useProjectProgressReport} />
        </TabsContent>
        <TabsContent value="tasks">
          <ReportSection useReport={useTasksSummaryReport} />
        </TabsContent>
        <TabsContent value="risks">
          <ReportSection useReport={useRisksSummaryReport} />
        </TabsContent>
        <TabsContent value="activity">
          <ReportSection useReport={useActivityReport} />
        </TabsContent>
      </Tabs>
    </div>
  );
}

function ReportSection({
  useReport,
}: {
  useReport: () => {
    data: Record<string, unknown> | undefined;
    isLoading: boolean;
    isError: boolean;
    refetch: () => void;
  };
}) {
  const { data, isLoading, isError, refetch } = useReport();

  if (isLoading) {
    return (
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <Skeleton key={i} className="h-24 rounded-xl" />
        ))}
      </div>
    );
  }

  if (isError) {
    return <ErrorState onRetry={() => refetch()} />;
  }

  if (!data || Object.keys(data).length === 0) {
    return (
      <EmptyState icon={BarChart3} title="No report data available" description="Check back once reporting data has been generated." />
    );
  }

  const entries = Object.entries(data);
  const scalarEntries = entries.filter(([, v]) => typeof v === "number" || typeof v === "string");
  const complexEntries = entries.filter(([, v]) => typeof v === "object" && v !== null);

  return (
    <div className="space-y-4">
      {scalarEntries.length > 0 ? (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {scalarEntries.map(([key, value]) => (
            <StatTile
              key={key}
              label={key.replace(/_/g, " ")}
              value={value as string | number}
            />
          ))}
        </div>
      ) : null}
      {complexEntries.map(([key, value]) => (
        <ComplexReportSection key={key} label={key.replace(/_/g, " ")} value={value} />
      ))}
    </div>
  );
}

function isActivityItem(v: unknown): v is ActivityItem {
  if (!v || typeof v !== "object") return false;
  const item = v as Record<string, unknown>;
  return (
    "actor" in item ||
    "actor_name" in item ||
    "action" in item ||
    "message" in item ||
    "description" in item
  );
}

function ComplexReportSection({ label, value }: { label: string; value: unknown }) {
  // Array of activity-shaped records (e.g. the activity report) — render
  // with the same ActivityRow used on the Projects Activity tab.
  if (Array.isArray(value)) {
    const items = value.filter(isActivityItem) as ActivityItem[];
    if (items.length > 0) {
      return (
        <div>
          <p className="mb-2 text-xs font-semibold uppercase text-muted-foreground">{label}</p>
          <div className="divide-y divide-border rounded-xl border border-border px-3">
            {items.map((item) => (
              <ActivityRow key={item.id} item={item} />
            ))}
          </div>
        </div>
      );
    }
    if (value.length === 0) return null;
  }

  // Plain object breakdown (e.g. by_status / by_priority counts) — render
  // each entry as a StatTile.
  if (!Array.isArray(value) && typeof value === "object" && value !== null) {
    const breakdown = Object.entries(value as Record<string, unknown>).filter(
      ([, v]) => typeof v === "number" || typeof v === "string",
    );
    if (breakdown.length > 0) {
      return (
        <div>
          <p className="mb-2 text-xs font-semibold uppercase text-muted-foreground">{label}</p>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
            {breakdown.map(([key, v]) => (
              <StatTile key={key} label={key.replace(/_/g, " ")} value={v as string | number} />
            ))}
          </div>
        </div>
      );
    }
  }

  // Fallback for shapes that don't fit the above (nested objects, etc.)
  return (
    <Card className="glass-panel">
      <CardContent>
        <p className="mb-2 text-xs font-semibold uppercase text-muted-foreground">{label}</p>
        <pre className="overflow-x-auto text-xs text-foreground">
          {JSON.stringify(value, null, 2)}
        </pre>
      </CardContent>
    </Card>
  );
}
