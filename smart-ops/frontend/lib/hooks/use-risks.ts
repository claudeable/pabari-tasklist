"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api-client";
import type { Risk } from "@/lib/types";

export function useRisks(projectId?: string) {
  return useQuery({
    queryKey: ["risks", projectId ?? "all"],
    queryFn: () => api.risks(projectId),
    enabled: Boolean(projectId),
  });
}

export function useCreateRisk() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (payload: Partial<Risk>) => api.createRisk(payload),
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({ queryKey: ["risks"] });
      if (variables.project_id) {
        queryClient.invalidateQueries({ queryKey: ["projects", variables.project_id] });
      }
    },
  });
}

export function useUpdateRisk() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, payload }: { id: string; payload: Partial<Risk> }) =>
      api.updateRisk(id, payload),
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({ queryKey: ["risks"] });
      if (variables.payload.project_id) {
        queryClient.invalidateQueries({
          queryKey: ["projects", variables.payload.project_id],
        });
      }
    },
  });
}

export function useDeleteRisk() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id }: { id: string; projectId?: string }) => api.deleteRisk(id),
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({ queryKey: ["risks"] });
      if (variables.projectId) {
        queryClient.invalidateQueries({ queryKey: ["projects", variables.projectId] });
      }
    },
  });
}
