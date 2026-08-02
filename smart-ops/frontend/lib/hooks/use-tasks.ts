"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api-client";
import type { Task } from "@/lib/types";

export function useTaskUpdates(taskId: string) {
  return useQuery({
    queryKey: ["tasks", "updates", taskId],
    queryFn: () => api.taskUpdates(taskId),
    enabled: Boolean(taskId),
  });
}

export function usePostTaskUpdate() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ taskId, description }: { taskId: string; description: string }) =>
      api.postTaskUpdate(taskId, description),
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({ queryKey: ["tasks", "updates", variables.taskId] });
    },
  });
}

export function useHkComments(taskId: string) {
  return useQuery({
    queryKey: ["tasks", "hk-comments", taskId],
    queryFn: () => api.taskHkComments(taskId),
    enabled: Boolean(taskId),
  });
}

export function usePostHkComment() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ taskId, description }: { taskId: string; description: string }) =>
      api.postTaskHkComment(taskId, description),
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({ queryKey: ["tasks", "hk-comments", variables.taskId] });
    },
  });
}

export function useTasks(projectId?: string) {
  return useQuery({
    queryKey: ["tasks", projectId ?? "all"],
    queryFn: () => api.tasks(projectId),
  });
}

export function useTask(id: string) {
  return useQuery({
    queryKey: ["tasks", "detail", id],
    queryFn: () => api.task(id),
    enabled: Boolean(id),
  });
}

export function useCreateTask() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (payload: Partial<Task>) => api.createTask(payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["tasks"] });
    },
  });
}

export function useUpdateTask() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, payload }: { id: string; payload: Partial<Task> }) =>
      api.updateTask(id, payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["tasks"] });
    },
  });
}

export function useDeleteTask() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => api.deleteTask(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["tasks"] });
    },
  });
}
