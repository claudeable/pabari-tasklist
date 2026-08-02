import { cn } from "@/lib/utils";

const ONLINE_WINDOW_MS = 5 * 60 * 1000;

interface OnlineDotProps {
  lastSeenAt?: string | null;
  className?: string;
}

/**
 * Small presence indicator: green if `lastSeenAt` is within the last 5
 * minutes, otherwise a muted grey dot. Designed to be usable inline or as
 * an absolutely-positioned corner badge on an Avatar (pass className to
 * position it, e.g. "absolute -right-0.5 -bottom-0.5").
 */
export function OnlineDot({ lastSeenAt, className }: OnlineDotProps) {
  const isOnline = Boolean(
    lastSeenAt && Date.now() - new Date(lastSeenAt).getTime() < ONLINE_WINDOW_MS,
  );

  return (
    <span
      className={cn(
        "inline-block h-2 w-2 shrink-0 rounded-full ring-2 ring-background",
        isOnline ? "bg-emerald-500" : "bg-muted-foreground/30",
        className,
      )}
      aria-label={isOnline ? "Online" : "Offline"}
    />
  );
}
