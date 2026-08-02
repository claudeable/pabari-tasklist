"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";

import { apiFetch, setAccessToken } from "@/lib/api-client";
import { clearChallengeToken, getChallengeToken } from "@/lib/auth-flow";
import { getDeviceFingerprint } from "@/lib/device";

interface VerifyResponse {
  status: string;
  access_token: string | null;
  expires_in: number | null;
}

export default function MfaVerifyPage() {
  const router = useRouter();
  const [token, setToken] = useState<string | null>(null);
  const [code, setCode] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    const t = getChallengeToken();
    if (!t) {
      router.replace("/login");
      return;
    }
    setToken(t);
  }, [router]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!token) return;
    setError(null);
    setSubmitting(true);
    try {
      const result = await apiFetch<VerifyResponse>("/api/v1/auth/mfa/verify", {
        method: "POST",
        body: JSON.stringify({
          challenge_token: token,
          totp_code: code,
          device_fingerprint: getDeviceFingerprint(),
        }),
      });
      setAccessToken(result.access_token);
      clearChallengeToken();
      router.push("/dashboard");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Invalid code");
    } finally {
      setSubmitting(false);
    }
  }

  if (!token) return null;

  return (
    <main className="flex min-h-screen items-center justify-center px-4">
      <form
        onSubmit={handleSubmit}
        className="w-full max-w-sm rounded-lg border border-vault-border bg-vault-surface p-8"
      >
        <h1 className="mb-1 text-lg font-semibold text-slate-100">Enter your authenticator code</h1>
        <p className="mb-6 text-sm text-slate-400">6-digit code from your authenticator app.</p>

        <input
          required
          pattern="\d{6}"
          maxLength={6}
          value={code}
          onChange={(e) => setCode(e.target.value)}
          className="mb-4 w-full rounded border border-vault-border bg-black/20 px-3 py-2 text-center font-mono text-lg tracking-widest text-slate-100 outline-none focus:border-vault-accent"
          autoFocus
        />

        {error && <p className="mb-4 text-sm text-red-400">{error}</p>}

        <button
          type="submit"
          disabled={submitting}
          className="w-full rounded bg-vault-accent px-3 py-2 text-sm font-medium text-white disabled:opacity-50"
        >
          {submitting ? "Verifying..." : "Verify"}
        </button>
      </form>
    </main>
  );
}
