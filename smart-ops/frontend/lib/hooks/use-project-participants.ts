"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api-client";
import type { ProjectParticipant } from "@/lib/types";

export function useProjectParticipants(projectId?: string) {
  return useQuery({
    queryKey: ["project-participants", projectId ?? "all"],
    queryFn: () => api.projectParticipants(projectId),
    enabled: Boolean(projectId),
  });
}

export function useCreateProjectParticipant() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (payload: Partial<ProjectParticipant>) => api.createProjectParticipant(payload),
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({ queryKey: ["project-participants"] });
      if (variables.project_id) {
        queryClient.invalidateQueries({ queryKey: ["projects", variables.project_id] });
      }
    },
  });
}

export function useDeleteProjectParticipant() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id }: { id: string; projectId?: string }) =>
      api.deleteProjectParticipant(id),
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({ queryKey: ["project-participants"] });
      if (variables.projectId) {
        queryClient.invalidateQueries({ queryKey: ["projects", variables.projectId] });
      }
    },
  });
}
