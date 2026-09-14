import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api-client";
import type { ProjectUpdate } from "@/lib/types";

export function useProjectUpdates(projectId?: string) {
  return useQuery<ProjectUpdate[]>({
    queryKey: ["project-updates", projectId],
    queryFn: () => api.projectUpdates(projectId!),
    enabled: Boolean(projectId),
  });
}

export function useCreateProjectUpdate(projectId?: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (payload: { body: string; source: string; email_from?: string; email_subject?: string; posted_at?: string; parent_update_id?: string; current_capacity?: string; project_requirement?: string; internal_notes?: string; action_items?: string }) =>
      api.createProjectUpdate(projectId!, payload),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["project-updates", projectId] });
    },
  });
}

export function useDeleteProjectUpdate(projectId?: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (updateId: string) => api.deleteProjectUpdate(projectId!, updateId),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["project-updates", projectId] });
    },
  });
}

export function useEditProjectUpdate(projectId?: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({
      updateId,
      payload,
    }: {
      updateId: string;
      payload: { body?: string; posted_at?: string; email_from?: string; email_subject?: string; current_capacity?: string; project_requirement?: string; internal_notes?: string; action_items?: string };
    }) => api.updateProjectUpdate(projectId!, updateId, payload),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["project-updates", projectId] });
    },
  });
}

export function useUploadProjectUpdateAttachment(projectId?: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ updateId, file }: { updateId: string; file: File }) =>
      api.uploadProjectUpdateAttachment(projectId!, updateId, file),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["project-updates", projectId] });
    },
  });
}

export function useDeleteProjectUpdateAttachment(projectId?: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (attachmentId: string) => api.deleteProjectUpdateAttachment(attachmentId),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["project-updates", projectId] });
    },
  });
}

export function useMarkProjectUpdateDone(projectId?: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ updateId, done }: { updateId: string; done: boolean }) =>
      api.markProjectUpdateDone(projectId!, updateId, done),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["project-updates", projectId] });
    },
  });
}

export function useSetProjectUpdateStatus(projectId?: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ updateId, status }: { updateId: string; status: string }) =>
      api.setProjectUpdateStatus(projectId!, updateId, status),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["project-updates", projectId] });
    },
  });
}

export function useAddProjectUpdateComment(projectId?: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ updateId, body }: { updateId: string; body: string }) =>
      api.addProjectUpdateComment(projectId!, updateId, body),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["project-updates", projectId] });
    },
  });
}
