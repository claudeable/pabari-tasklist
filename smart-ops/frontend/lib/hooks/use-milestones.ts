"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api-client";
import type { Milestone } from "@/lib/types";

export function useMilestones(projectId?: string) {
  return useQuery({
    queryKey: ["milestones", projectId ?? "all"],
    queryFn: () => api.milestones(projectId),
    enabled: Boolean(projectId),
  });
}

export function useCreateMilestone() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (payload: Partial<Milestone>) => api.createMilestone(payload),
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({ queryKey: ["milestones"] });
      if (variables.project_id) {
        queryClient.invalidateQueries({ queryKey: ["projects", variables.project_id] });
      }
    },
  });
}

export function useUpdateMilestone() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, payload }: { id: string; payload: Partial<Milestone> }) =>
      api.updateMilestone(id, payload),
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({ queryKey: ["milestones"] });
      if (variables.payload.project_id) {
        queryClient.invalidateQueries({
          queryKey: ["projects", variables.payload.project_id],
        });
      }
    },
  });
}

export function useDeleteMilestone() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id }: { id: string; projectId?: string }) => api.deleteMilestone(id),
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({ queryKey: ["milestones"] });
      if (variables.projectId) {
        queryClient.invalidateQueries({ queryKey: ["projects", variables.projectId] });
      }
    },
  });
}
