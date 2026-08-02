"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api-client";
import type { SiteReport } from "@/lib/types";

export function useSiteReports(projectId?: string) {
  return useQuery({
    queryKey: ["site-reports", projectId ?? "all"],
    queryFn: () => api.siteReports(projectId),
  });
}

export function useCreateSiteReport() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (payload: Partial<SiteReport>) => api.createSiteReport(payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["site-reports"] });
    },
  });
}

export function useDeleteSiteReport() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => api.deleteSiteReport(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["site-reports"] });
    },
  });
}
