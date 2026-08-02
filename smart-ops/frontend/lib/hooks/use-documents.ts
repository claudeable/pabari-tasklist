"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api-client";
import type { DocumentRecord } from "@/lib/types";

export function useDocuments(projectId?: string) {
  return useQuery({
    queryKey: ["documents", projectId ?? "all"],
    queryFn: () => api.documents(projectId),
  });
}

export function useDocument(id: string) {
  return useQuery({
    queryKey: ["documents", "detail", id],
    queryFn: () => api.document(id),
    enabled: Boolean(id),
  });
}

export function useCreateDocument() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (payload: Partial<DocumentRecord>) => api.createDocument(payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["documents"] });
    },
  });
}

export function useUpdateDocument() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, payload }: { id: string; payload: Partial<DocumentRecord> }) =>
      api.updateDocument(id, payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["documents"] });
    },
  });
}

export function useDeleteDocument() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => api.deleteDocument(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["documents"] });
    },
  });
}
