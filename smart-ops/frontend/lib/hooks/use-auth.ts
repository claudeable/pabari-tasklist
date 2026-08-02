"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import { api, ApiError } from "@/lib/api-client";
import { clearSignedIn, isSignedIn, markSignedIn } from "@/lib/auth";

export function useCurrentUser() {
  return useQuery({
    queryKey: ["auth", "me"],
    queryFn: api.me,
    enabled: isSignedIn(),
    retry: false,
  });
}

export function useLogin() {
  const router = useRouter();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ email, password }: { email: string; password: string }) =>
      api.login(email, password),
    onSuccess: () => {
      // The real token is now in an httpOnly cookie set by the backend;
      // this just flags "signed in" for middleware's redirect check.
      markSignedIn();
      queryClient.invalidateQueries({ queryKey: ["auth"] });
      router.push("/dashboard");
    },
  });
}

export function useLogout() {
  const router = useRouter();
  const queryClient = useQueryClient();

  return () => {
    api.logout().catch(() => {
      // Best-effort — clear the local flag and redirect regardless.
    });
    clearSignedIn();
    queryClient.clear();
    router.push("/login");
  };
}

export function useUpdateProfile() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: api.updateMe,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["auth", "me"] });
    },
  });
}

export function isApiError(error: unknown): error is ApiError {
  return error instanceof ApiError;
}
