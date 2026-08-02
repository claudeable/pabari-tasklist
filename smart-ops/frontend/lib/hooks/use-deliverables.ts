"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api-client";
import type { Deliverable } from "@/lib/types";

export function useDeliverables(projectId?: string) {
  return useQuery({
    queryKey: ["deliverables", projectId ?? "all"],
    queryFn: () => api.deliverables(projectId),
    enabled: Boolean(projectId),
  });
}

export function useCreateDeliverable() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (payload: Partial<Deliverable>) => api.createDeliverable(payload),
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({ queryKey: ["deliverables"] });
      if (variables.project_id) {
        queryClient.invalidateQueries({ queryKey: ["projects", variables.project_id] });
      }
    },
  });
}

export function useUpdateDeliverable() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, payload }: { id: string; payload: Partial<Deliverable> }) =>
      api.updateDeliverable(id, payload),
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({ queryKey: ["deliverables"] });
      if (variables.payload.project_id) {
        queryClient.invalidateQueries({
          queryKey: ["projects", variables.payload.project_id],
        });
      }
    },
  });
}

export function useDeleteDeliverable() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id }: { id: string; projectId?: string }) => api.deleteDeliverable(id),
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({ queryKey: ["deliverables"] });
      if (variables.projectId) {
        queryClient.invalidateQueries({ queryKey: ["projects", variables.projectId] });
      }
    },
  });
}
