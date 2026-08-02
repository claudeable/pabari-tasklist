"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";

import { apiFetch, ApiError, setAccessToken } from "@/lib/api-client";

interface MeResponse {
  id: string;
  alias: string;
  system_role: string;
  mfa_enabled: boolean;
}

export default function HomePage() {
  const router = useRouter();
  const [me, setMe] = useState<MeResponse | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    apiFetch<MeResponse>("/api/v1/users/me")
      .then(setMe)
      .catch((err) => {
        if (err instanceof ApiError && err.status === 401) {
          router.replace("/login");
          return;
        }
        setError(err instanceof Error ? err.message : "Failed to load profile");
      });
  }, [router]);

  async function handleLogout() {
    await apiFetch("/api/v1/auth/logout", { method: "POST" }).catch(() => {});
    setAccessToken(null);
    router.push("/login");
  }

  return (
    <main className="min-h-screen px-6 py-10">
      <div className="mx-auto max-w-2xl">
        <div className="mb-8 flex items-center justify-between">
          <h1 className="text-lg font-semibold text-slate-100">pil-transmission-lines-app</h1>
          <button
            onClick={handleLogout}
            className="rounded border border-vault-border px-3 py-1.5 text-sm text-slate-300 hover:border-vault-accent"
          >
            Sign out
          </button>
        </div>

        {error && <p className="text-sm text-red-400">{error}</p>}

        {me ? (
          <div className="rounded-lg border border-vault-border bg-vault-surface p-6">
            <p className="text-sm text-slate-400">Signed in as</p>
            <p className="mb-4 text-2xl font-semibold text-slate-100">{me.alias}</p>
            <dl className="grid grid-cols-2 gap-y-2 text-sm">
              <dt className="text-slate-500">System role</dt>
              <dd className="text-slate-200">{me.system_role}</dd>
              <dt className="text-slate-500">MFA enabled</dt>
              <dd className="text-slate-200">{me.mfa_enabled ? "Yes" : "No"}</dd>
            </dl>
            <Link
              href="/dashboard"
              className="mt-6 inline-block rounded bg-vault-accent px-4 py-2 text-sm text-white"
            >
              Go to Dashboard
            </Link>

            <p className="mt-6 text-xs text-slate-500">
              The admin panel UI is not built yet (backend API for all six phases is live and
              tested — see docs/14-development-roadmap.md).
            </p>
          </div>
        ) : (
          !error && <p className="text-sm text-slate-400">Loading...</p>
        )}
      </div>
    </main>
  );
}
