// ============================================================
// PIL / KETRACO — SSO Landing Page
// Portal: PIL (pil-transmission-lines-app)
// Master portal: Pabari ERP
//
// Flow:
//   1. Pabari ERP redirects here: /auth/sso?token=<one-time-token>
//   2. This page calls POST /api/v1/auth/sso with the token
//   3. PIL backend validates with Pabari, looks up user by pabari_email
//   4. On success: store access token in memory, redirect to /dashboard
//   5. On failure: show error with link back to Pabari hub
// ============================================================
"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useState } from "react";
import { apiFetch, setAccessToken } from "@/lib/api-client";

interface LoginResult {
  status: "authenticated";
  access_token: string | null;
  expires_in: number | null;
  challenge_token: string | null;
}

export default function SsoPage() {
  const router       = useRouter();
  const searchParams = useSearchParams();
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const token = searchParams.get("token");
    if (!token) {
      setError("No SSO token provided. Please launch PIL from the Pabari ERP hub.");
      return;
    }

    apiFetch<LoginResult>("/api/v1/auth/sso", {
      method: "POST",
      body: JSON.stringify({ pabari_token: token }),
    })
      .then((result) => {
        if (result.status === "authenticated" && result.access_token) {
          setAccessToken(result.access_token);
          router.push("/dashboard");
        } else {
          setError("Unexpected SSO response. Please try again from the Pabari hub.");
        }
      })
      .catch((err: Error) => {
        setError(err.message ?? "SSO login failed. Your link may have expired — please try again.");
      });
  }, [searchParams, router]);

  return (
    <main className="flex min-h-screen items-center justify-center px-4">
      <div className="w-full max-w-sm rounded-lg border border-vault-border bg-vault-surface p-8 text-center">
        <h1 className="mb-2 text-lg font-semibold text-slate-100">PIL / KETRACO</h1>

        {!error ? (
          <>
            <p className="mb-6 text-sm text-slate-400">Signing you in via Pabari ERP…</p>
            {/* Minimal spinner */}
            <div
              style={{
                width: 32, height: 32, margin: "0 auto",
                border: "3px solid rgba(255,255,255,0.1)",
                borderTopColor: "#fb923c",
                borderRadius: "50%",
                animation: "spin 0.8s linear infinite",
              }}
            />
            <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
          </>
        ) : (
          <>
            <p className="mb-6 text-sm text-red-400">{error}</p>
            <a
              href={process.env.NEXT_PUBLIC_PABARI_URL ?? "https://pabari-workspace.up.railway.app"}
              className="text-sm text-slate-400 underline hover:text-slate-200"
            >
              ← Back to Pabari ERP
            </a>
          </>
        )}
      </div>
    </main>
  );
}
