"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api-client";
import type { Drawing, DrawingComment } from "@/lib/types";

export function useDrawings(projectId?: string) {
  return useQuery({
    queryKey: ["drawings", projectId ?? "all"],
    queryFn: () => api.drawings(projectId),
  });
}

export function useDrawing(id: string) {
  return useQuery({
    queryKey: ["drawings", "detail", id],
    queryFn: () => api.drawing(id),
    enabled: Boolean(id),
  });
}

export function useCreateDrawing() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (payload: Partial<Drawing>) => api.createDrawing(payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["drawings"] });
    },
  });
}

export function useUpdateDrawing() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, payload }: { id: string; payload: Partial<Drawing> }) =>
      api.updateDrawing(id, payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["drawings"] });
    },
  });
}

export function useDeleteDrawing() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => api.deleteDrawing(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["drawings"] });
    },
  });
}

export function useCreateDrawingComment(drawingId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (payload: Partial<DrawingComment>) =>
      api.createDrawingComment(drawingId, payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["drawings", "detail", drawingId] });
    },
  });
}
