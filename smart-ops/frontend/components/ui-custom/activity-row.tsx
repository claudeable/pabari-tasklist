import { formatDistanceToNowStrict } from "date-fns";
import type { ActivityItem } from "@/lib/types";

export function formatTimestamp(value?: string) {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return `${formatDistanceToNowStrict(date)} ago`;
}

export function ActivityRow({ item }: { item: ActivityItem }) {
  const actor = item.actor_name || item.actor || "Someone";
  const text = item.description || item.message || item.action || "performed an action";
  const time = formatTimestamp(item.timestamp || item.created_at);

  return (
    <div className="flex items-start gap-3 py-2">
      <div className="mt-1 h-1.5 w-1.5 shrink-0 rounded-full bg-primary" />
      <div className="min-w-0 flex-1">
        <p className="text-sm text-foreground">
          <span className="font-medium">{actor}</span>{" "}
          <span className="text-muted-foreground">{text}</span>
        </p>
        {time ? <p className="text-xs text-muted-foreground">{time}</p> : null}
      </div>
    </div>
  );
}
