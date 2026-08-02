import type { LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";

interface StatTileProps {
  label: string;
  value: string | number;
  icon?: LucideIcon;
  trend?: string;
  trendDirection?: "up" | "down" | "neutral";
  className?: string;
}

export function StatTile({
  label,
  value,
  icon: Icon,
  trend,
  trendDirection = "neutral",
  className,
}: StatTileProps) {
  return (
    <div
      className={cn(
        "flex items-center justify-between rounded-lg border border-border bg-card/60 p-4",
        className,
      )}
    >
      <div>
        <p className="text-xs font-medium text-muted-foreground">{label}</p>
        <p className="mt-1 text-2xl font-semibold tabular-nums text-foreground">{value}</p>
        {trend ? (
          <p
            className={cn(
              "mt-1 text-xs font-medium",
              trendDirection === "up" && "text-emerald-600 dark:text-emerald-400",
              trendDirection === "down" && "text-red-600 dark:text-red-400",
              trendDirection === "neutral" && "text-muted-foreground",
            )}
          >
            {trend}
          </p>
        ) : null}
      </div>
      {Icon ? (
        <div className="rounded-md bg-primary/10 p-2 text-primary">
          <Icon className="h-5 w-5" />
        </div>
      ) : null}
    </div>
  );
}
