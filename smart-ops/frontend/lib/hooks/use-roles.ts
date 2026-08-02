"use client";

import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api-client";

export function useRoles() {
  return useQuery({
    queryKey: ["roles"],
    queryFn: () => api.roles(),
    staleTime: 5 * 60 * 1000,
  });
}
