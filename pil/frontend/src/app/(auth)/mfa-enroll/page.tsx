"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";

import { apiFetch } from "@/lib/api-client";
import { clearChallengeToken, getChallengeToken } from "@/lib/auth-flow";

interface EnrollResponse {
  provisioning_uri: string;
  secret: string;
}

export default function MfaEnrollPage() {
  const router = useRouter();
  const [token, setToken] = useState<string | null>(null);
  const [secret, setSecret] = useState<string | null>(null);
  const [uri, setUri] = useState<string | null>(null);
  const [code, setCode] = useState("");
  const [backupCodes, setBackupCodes] = useState<string[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    const t = getChallengeToken();
    if (!t) {
      router.replace("/login");
      return;
    }
    setToken(t);
    apiFetch<EnrollResponse>("/api/v1/auth/mfa/enroll", { method: "POST", bearerToken: t })
      .then((res) => {
        setSecret(res.secret);
        setUri(res.provisioning_uri);
      })
      .catch((err) => setError(err instanceof Error ? err.message : "Could not start enrollment"));
  }, [router]);

  async function handleConfirm(e: React.FormEvent) {
    e.preventDefault();
    if (!token || !secret) return;
    setError(null);
    setSubmitting(true);
    try {
      const res = await apiFetch<{ backup_codes: string[] }>("/api/v1/auth/mfa/enroll/confirm", {
        method: "POST",
        bearerToken: token,
        body: JSON.stringify({ secret, totp_code: code }),
      });
      setBackupCodes(res.backup_codes);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Invalid code");
    } finally {
      setSubmitting(false);
    }
  }

  if (backupCodes) {
    return (
      <main className="flex min-h-screen items-center justify-center px-4">
        <div className="w-full max-w-md rounded-lg border border-vault-border bg-vault-surface p-8">
          <h1 className="mb-1 text-lg font-semibold text-slate-100">MFA enabled</h1>
          <p className="mb-4 text-sm text-slate-400">
            Save these single-use backup codes somewhere safe. Each can be used once if you lose your
            authenticator.
          </p>
          <ul className="mb-6 grid grid-cols-2 gap-2 rounded border border-vault-border bg-black/20 p-3 font-mono text-xs text-slate-200">
            {backupCodes.map((c) => (
              <li key={c}>{c}</li>
            ))}
          </ul>
          <button
            onClick={() => {
              clearChallengeToken();
              router.push("/login");
            }}
            className="w-full rounded bg-vault-accent px-3 py-2 text-sm font-medium text-white"
          >
            Continue to sign in
          </button>
        </div>
      </main>
    );
  }

  return (
    <main className="flex min-h-screen items-center justify-center px-4">
      <div className="w-full max-w-sm rounded-lg border border-vault-border bg-vault-surface p-8">
        <h1 className="mb-1 text-lg font-semibold text-slate-100">Set up multi-factor authentication</h1>
        <p className="mb-4 text-sm text-slate-400">
          Your role requires MFA. Add this account to an authenticator app (e.g. any TOTP app), or enter
          the secret manually.
        </p>

        {secret ? (
          <div className="mb-4 rounded border border-vault-border bg-black/20 p-3">
            <p className="mb-1 text-xs text-slate-500">Secret</p>
            <p className="break-all font-mono text-sm text-slate-200">{secret}</p>
            {uri && <p className="mt-2 break-all text-xs text-slate-500">{uri}</p>}
          </div>
        ) : (
          !error && <p className="mb-4 text-sm text-slate-400">Loading...</p>
        )}

        <form onSubmit={handleConfirm}>
          <label className="mb-1 block text-sm text-slate-300" htmlFor="code">
            6-digit code
          </label>
          <input
            id="code"
            required
            pattern="\d{6}"
            maxLength={6}
            value={code}
            onChange={(e) => setCode(e.target.value)}
            className="mb-4 w-full rounded border border-vault-border bg-black/20 px-3 py-2 text-sm text-slate-100 outline-none focus:border-vault-accent"
          />
          {error && <p className="mb-4 text-sm text-red-400">{error}</p>}
          <button
            type="submit"
            disabled={submitting || !secret}
            className="w-full rounded bg-vault-accent px-3 py-2 text-sm font-medium text-white disabled:opacity-50"
          >
            {submitting ? "Verifying..." : "Confirm"}
          </button>
        </form>
      </div>
    </main>
  );
}
