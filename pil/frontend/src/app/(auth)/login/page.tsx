"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

import { apiFetch, setAccessToken } from "@/lib/api-client";
import { setChallengeToken } from "@/lib/auth-flow";
import { getDeviceFingerprint } from "@/lib/device";

interface LoginResult {
  status: "authenticated" | "mfa_required" | "mfa_enrollment_required" | "password_change_required";
  challenge_token: string | null;
  access_token: string | null;
  expires_in: number | null;
}

/**
 * Alias-only login (Authentication Design doc §1). No "forgot password" link —
 * password recovery is admin-mediated only, by design.
 */
export default function LoginPage() {
  const router = useRouter();
  const [alias, setAlias] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      const result = await apiFetch<LoginResult>("/api/v1/auth/login", {
        method: "POST",
        body: JSON.stringify({
          alias,
          password,
          device_fingerprint: getDeviceFingerprint(),
        }),
      });

      switch (result.status) {
        case "authenticated":
          setAccessToken(result.access_token);
          router.push("/dashboard");
          return;
        case "password_change_required":
          setChallengeToken(result.challenge_token!);
          router.push("/change-password");
          return;
        case "mfa_enrollment_required":
          setChallengeToken(result.challenge_token!);
          router.push("/mfa-enroll");
          return;
        case "mfa_required":
          setChallengeToken(result.challenge_token!);
          router.push(`/mfa-verify?alias=${encodeURIComponent(alias)}`);
          return;
      }
    } catch (err) {
      // Deliberately generic — the backend already collapses unknown-alias vs
      // wrong-password vs disabled-account into one message (Authentication
      // Design doc §6); the frontend must not add its own more-specific guess.
      setError(err instanceof Error ? err.message : "Invalid credentials");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <main className="flex min-h-screen items-center justify-center px-4">
      <form
        onSubmit={handleSubmit}
        className="w-full max-w-sm rounded-lg border border-vault-border bg-vault-surface p-8"
      >
        <h1 className="mb-1 text-lg font-semibold text-slate-100">pil-transmission-lines-app</h1>
        <p className="mb-6 text-sm text-slate-400">Sign in with your alias.</p>

        <label className="mb-1 block text-sm text-slate-300" htmlFor="alias">
          Alias
        </label>
        <input
          id="alias"
          name="alias"
          autoComplete="username"
          required
          value={alias}
          onChange={(e) => setAlias(e.target.value)}
          className="mb-4 w-full rounded border border-vault-border bg-black/20 px-3 py-2 text-sm text-slate-100 outline-none focus:border-vault-accent"
          placeholder="Falcon-01"
        />

        <label className="mb-1 block text-sm text-slate-300" htmlFor="password">
          Password
        </label>
        <input
          id="password"
          name="password"
          type="password"
          autoComplete="current-password"
          required
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          className="mb-6 w-full rounded border border-vault-border bg-black/20 px-3 py-2 text-sm text-slate-100 outline-none focus:border-vault-accent"
        />

        {error && <p className="mb-4 text-sm text-red-400">{error}</p>}

        <button
          type="submit"
          disabled={submitting}
          className="w-full rounded bg-vault-accent px-3 py-2 text-sm font-medium text-white disabled:opacity-50"
        >
          {submitting ? "Signing in..." : "Sign in"}
        </button>

        <p className="mt-6 text-xs text-slate-500">
          No self-registration. Accounts are created by your organization&apos;s administrator.
        </p>
      </form>
    </main>
  );
}
