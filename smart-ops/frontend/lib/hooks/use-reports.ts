"use client";

import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api-client";

export function useProjectProgressReport() {
  return useQuery({
    queryKey: ["reports", "project-progress"],
    queryFn: api.projectProgressReport,
  });
}

export function useTasksSummaryReport() {
  return useQuery({
    queryKey: ["reports", "tasks-summary"],
    queryFn: api.tasksSummaryReport,
  });
}

export function useRisksSummaryReport() {
  return useQuery({
    queryKey: ["reports", "risks-summary"],
    queryFn: api.risksSummaryReport,
  });
}

export function useActivityReport() {
  return useQuery({
    queryKey: ["reports", "activity"],
    queryFn: api.activityReport,
  });
}
