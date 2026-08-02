"use client";

import { useMemo } from "react";
import { Bell, CheckCheck } from "lucide-react";
import { toast } from "sonner";
import { PageHeader } from "@/components/ui-custom/page-header";
import { EmptyState } from "@/components/ui-custom/empty-state";
import { ErrorState } from "@/components/ui-custom/error-state";
import { formatTimestamp } from "@/components/ui-custom/activity-row";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";
import {
  useMarkAllNotificationsRead,
  useMarkNotificationRead,
  useNotifications,
} from "@/lib/hooks/use-notifications";
import type { AppNotification } from "@/lib/types";

export default function NotificationsPage() {
  const { data, isLoading, isError, refetch } = useNotifications();
  const markRead = useMarkNotificationRead();
  const markAllRead = useMarkAllNotificationsRead();

  const notifications = useMemo(() => data ?? [], [data]);
  const unreadCount = useMemo(
    () => notifications.filter((n) => !n.is_read).length,
    [notifications],
  );

  function handleClick(notification: AppNotification) {
    if (notification.is_read) return;
    markRead.mutate(notification.id, {
      onError: () => toast.error("Failed to mark notification as read"),
    });
  }

  function handleMarkAllRead() {
    markAllRead.mutate(undefined, {
      onSuccess: () => toast.success("All notifications marked as read"),
      onError: () => toast.error("Failed to mark all as read"),
    });
  }

  return (
    <div>
      <PageHeader
        title="Notifications"
        description="Activity from every module across both organizations."
        actions={
          <Button
            variant="outline"
            size="sm"
            className="gap-1.5"
            onClick={handleMarkAllRead}
            disabled={markAllRead.isPending || unreadCount === 0}
          >
            <CheckCheck className="h-3.5 w-3.5" />
            Mark all as read
          </Button>
        }
      />

      {isLoading ? (
        <div className="space-y-2">
          {Array.from({ length: 6 }).map((_, i) => (
            <Skeleton key={i} className="h-16 rounded-xl" />
          ))}
        </div>
      ) : isError ? (
        <ErrorState onRetry={() => refetch()} />
      ) : notifications.length === 0 ? (
        <EmptyState icon={Bell} title="No notifications" description="You're all caught up." />
      ) : (
        <div className="divide-y divide-border rounded-xl border border-border">
          {notifications.map((notification) => (
            <button
              key={notification.id}
              onClick={() => handleClick(notification)}
              className={cn(
                "flex w-full items-start gap-3 p-4 text-left transition-colors hover:bg-muted/50",
                !notification.is_read && "bg-primary/5",
              )}
            >
              <span
                className={cn(
                  "mt-1.5 h-2 w-2 shrink-0 rounded-full",
                  notification.is_read ? "bg-transparent" : "bg-primary",
                )}
              />
              <div className="min-w-0 flex-1">
                <div className="flex items-center justify-between gap-2">
                  <p
                    className={cn(
                      "truncate text-sm",
                      notification.is_read
                        ? "text-muted-foreground"
                        : "font-medium text-foreground",
                    )}
                  >
                    {notification.title}
                  </p>
                  <span className="shrink-0 text-xs text-muted-foreground">
                    {formatTimestamp(notification.created_at)}
                  </span>
                </div>
                {notification.body ? (
                  <p className="mt-0.5 truncate text-xs text-muted-foreground">
                    {notification.body}
                  </p>
                ) : null}
              </div>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
