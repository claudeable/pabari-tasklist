"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api-client";
import type { Channel, ChannelMessage } from "@/lib/types";

export function useChannels(projectId?: string) {
  return useQuery({
    queryKey: ["channels", projectId ?? "all"],
    queryFn: () => api.channels(projectId),
    enabled: Boolean(projectId),
  });
}

export function useCreateChannel() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (payload: Partial<Channel>) => api.createChannel(payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["channels"] });
    },
  });
}

export function useChannelMessages(channelId?: string) {
  return useQuery({
    queryKey: ["channels", channelId, "messages"],
    queryFn: () => api.channelMessages(channelId as string),
    enabled: Boolean(channelId),
    refetchInterval: 5000,
  });
}

export function useSendChannelMessage(channelId?: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (payload: Partial<ChannelMessage>) =>
      api.sendChannelMessage(channelId as string, payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["channels", channelId, "messages"] });
    },
  });
}

export function useDirectChannels() {
  return useQuery({
    queryKey: ["channels", "direct"],
    queryFn: () => api.directChannels(),
  });
}

export function useCreateDirectChannel() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (otherUserId: string) => api.createDirectChannel(otherUserId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["channels", "direct"] });
    },
  });
}
