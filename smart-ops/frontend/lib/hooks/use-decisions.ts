"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api-client";
import type { Decision } from "@/lib/types";

export function useDecisions(projectId?: string) {
  return useQuery({
    queryKey: ["decisions", projectId ?? "all"],
    queryFn: () => api.decisions(projectId),
    enabled: Boolean(projectId),
  });
}

export function useCreateDecision() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (payload: Partial<Decision>) => api.createDecision(payload),
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({ queryKey: ["decisions"] });
      if (variables.project_id) {
        queryClient.invalidateQueries({ queryKey: ["projects", variables.project_id] });
      }
    },
  });
}

export function useUpdateDecision() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, payload }: { id: string; payload: Partial<Decision> }) =>
      api.updateDecision(id, payload),
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({ queryKey: ["decisions"] });
      if (variables.payload.project_id) {
        queryClient.invalidateQueries({
          queryKey: ["projects", variables.payload.project_id],
        });
      }
    },
  });
}

export function useDeleteDecision() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id }: { id: string; projectId?: string }) => api.deleteDecision(id),
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({ queryKey: ["decisions"] });
      if (variables.projectId) {
        queryClient.invalidateQueries({ queryKey: ["projects", variables.projectId] });
      }
    },
  });
}
