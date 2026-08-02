// ============================================================
// SMART OPS PORTAL — SSO Landing Page
// Portal: Smart Ops (joint-collaboration-portal)
// Master portal: Pabari Workspace
//
// Flow:
//   1. Pabari Workspace redirects here: /sso?token=<one-time-token>
//   2. This page calls POST /api/v1/auth/sso with the token
//   3. Smart Ops backend validates with Pabari, looks up user by email
//   4. On success: set jcp_session flag cookie, redirect to /dashboard
//   5. On failure: show error with link back to Pabari hub
// ============================================================
"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useState } from "react";
import { Waves } from "lucide-react";
import { API_BASE_URL } from "@/lib/api-client";
import { markSignedIn } from "@/lib/auth";

const PABARI_URL =
  process.env.NEXT_PUBLIC_PABARI_URL ?? "https://pabari-workspace.up.railway.app";

export default function SsoPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const token = searchParams.get("token");
    if (!token) {
      setError("No SSO token provided. Please launch Smart Ops from the Pabari Workspace hub.");
      return;
    }

    fetch(`${API_BASE_URL}/auth/sso`, {
      method: "POST",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ pabari_token: token }),
    })
      .then(async (r) => {
        if (!r.ok) {
          const data = await r.json().catch(() => ({}));
          throw new Error(data?.detail ?? `SSO failed (${r.status})`);
        }
        return r.json();
      })
      .then(() => {
        markSignedIn();
        router.push("/dashboard");
      })
      .catch((err: Error) => {
        setError(
          err.message ?? "SSO login failed. Your link may have expired — please try again.",
        );
      });
  }, [searchParams, router]);

  return (
    <div className="relative flex min-h-screen flex-1 items-center justify-center overflow-hidden bg-slate-50 px-4 dark:bg-slate-950">
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_20%_20%,theme(colors.blue.100),transparent_45%),radial-gradient(circle_at_80%_0%,theme(colors.blue.50),transparent_40%)] dark:bg-[radial-gradient(circle_at_20%_20%,theme(colors.blue.950),transparent_45%),radial-gradient(circle_at_80%_0%,theme(colors.slate.900),transparent_40%)]"
      />

      <div className="glass-panel relative z-10 w-full max-w-sm rounded-xl border bg-white/80 p-8 text-center shadow-xl dark:bg-slate-900/80">
        <div className="mb-4 flex justify-center">
          <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-primary text-primary-foreground shadow-sm">
            <Waves className="h-5 w-5" />
          </div>
        </div>

        <h1 className="mb-1 text-lg font-semibold text-slate-900 dark:text-slate-100">
          Smart Ops Portal
        </h1>

        {!error ? (
          <>
            <p className="mb-6 text-sm text-slate-500 dark:text-slate-400">
              Signing you in via Pabari Workspace…
            </p>
            <div
              style={{
                width: 32,
                height: 32,
                margin: "0 auto",
                border: "3px solid rgba(99,102,241,0.2)",
                borderTopColor: "rgb(99,102,241)",
                borderRadius: "50%",
                animation: "spin 0.8s linear infinite",
              }}
            />
            <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
          </>
        ) : (
          <>
            <p className="mb-6 text-sm text-red-600 dark:text-red-400">{error}</p>
            <a
              href={PABARI_URL}
              className="text-sm text-slate-500 underline hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200"
            >
              ← Back to Pabari Workspace
            </a>
          </>
        )}
      </div>
    </div>
  );
}
