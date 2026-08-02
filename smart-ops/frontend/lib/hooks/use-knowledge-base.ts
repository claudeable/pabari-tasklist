"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api-client";
import type { KbArticle } from "@/lib/types";

export function useKbArticles(params?: { category?: string; q?: string }) {
  return useQuery({
    queryKey: ["kb-articles", params?.category ?? "all", params?.q ?? ""],
    queryFn: () => api.kbArticles(params),
  });
}

export function useKbArticle(id: string) {
  return useQuery({
    queryKey: ["kb-articles", "detail", id],
    queryFn: () => api.kbArticle(id),
    enabled: Boolean(id),
  });
}

export function useCreateKbArticle() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (payload: Partial<KbArticle>) => api.createKbArticle(payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["kb-articles"] });
    },
  });
}
