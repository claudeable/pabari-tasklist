import { cn } from "@/lib/utils";

type ToneKey =
  | "success"
  | "warning"
  | "danger"
  | "info"
  | "neutral";

const TONE_CLASSES: Record<ToneKey, string> = {
  success:
    "bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-500/10 dark:text-emerald-400 dark:border-emerald-500/20",
  warning:
    "bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-500/10 dark:text-amber-400 dark:border-amber-500/20",
  danger:
    "bg-red-50 text-red-700 border-red-200 dark:bg-red-500/10 dark:text-red-400 dark:border-red-500/20",
  info: "bg-blue-50 text-blue-700 border-blue-200 dark:bg-blue-500/10 dark:text-blue-400 dark:border-blue-500/20",
  neutral:
    "bg-slate-100 text-slate-700 border-slate-200 dark:bg-slate-500/10 dark:text-slate-300 dark:border-slate-500/20",
};

const STATUS_TONE_MAP: Record<string, ToneKey> = {
  active: "success",
  on_track: "success",
  completed: "info",
  done: "success",
  approved: "success",
  planning: "info",
  in_progress: "info",
  on_hold: "warning",
  at_risk: "warning",
  pending: "warning",
  delayed: "danger",
  off_track: "danger",
  cancelled: "danger",
  blocked: "danger",
  rejected: "danger",
};

function toTone(status: string): ToneKey {
  const key = status.toLowerCase().replace(/\s+/g, "_");
  return STATUS_TONE_MAP[key] ?? "neutral";
}

function toLabel(status: string): string {
  return status
    .replace(/_/g, " ")
    .replace(/\b\w/g, (c) => c.toUpperCase());
}

interface StatusPillProps {
  status: string;
  className?: string;
}

export function StatusPill({ status, className }: StatusPillProps) {
  if (!status) return null;
  const tone = toTone(status);
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-xs font-medium",
        TONE_CLASSES[tone],
        className,
      )}
    >
      <span className="h-1.5 w-1.5 rounded-full bg-current" />
      {toLabel(status)}
    </span>
  );
}
