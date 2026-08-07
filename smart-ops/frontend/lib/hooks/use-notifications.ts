"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api-client";
import { isSignedIn } from "@/lib/auth";

export function useNotifications() {
  return useQuery({
    queryKey: ["notifications"],
    queryFn: api.notifications,
    enabled: isSignedIn(),
  });
}

export function useUnreadNotificationsCount() {
  return useQuery({
    queryKey: ["notifications", "unread-count"],
    queryFn: api.unreadNotificationsCount,
    enabled: isSignedIn(),
    refetchInterval: 30000,
  });
}

export function useUnreadMessageCount() {
  return useQuery({
    queryKey: ["notifications", "unread-messages"],
    queryFn: api.unreadMessagesCount,
    enabled: isSignedIn(),
    refetchInterval: 15000,
  });
}

export function useMarkNotificationRead() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => api.markNotificationRead(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["notifications"] });
    },
  });
}

export function useMarkAllNotificationsRead() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: () => api.markAllNotificationsRead(),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["notifications"] });
    },
  });
}
