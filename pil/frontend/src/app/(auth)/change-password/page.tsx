"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";

import { apiFetch } from "@/lib/api-client";
import { clearChallengeToken, getChallengeToken } from "@/lib/auth-flow";

export default function ChangePasswordPage() {
  const router = useRouter();
  const [token, setToken] = useState<string | null>(null);
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
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
      await apiFetch("/api/v1/auth/password/change", {
        method: "POST",
        bearerToken: token,
        body: JSON.stringify({ current_password: currentPassword, new_password: newPassword }),
      });
      clearChallengeToken();
      router.push("/login?changed=1");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not change password");
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
        <h1 className="mb-1 text-lg font-semibold text-slate-100">Password change required</h1>
        <p className="mb-6 text-sm text-slate-400">
          This is a one-time password. Choose a new password to continue.
        </p>

        <label className="mb-1 block text-sm text-slate-300" htmlFor="current">
          Current (one-time) password
        </label>
        <input
          id="current"
          type="password"
          autoComplete="current-password"
          required
          value={currentPassword}
          onChange={(e) => setCurrentPassword(e.target.value)}
          className="mb-4 w-full rounded border border-vault-border bg-black/20 px-3 py-2 text-sm text-slate-100 outline-none focus:border-vault-accent"
        />

        <label className="mb-1 block text-sm text-slate-300" htmlFor="new">
          New password (8+ characters)
        </label>
        <input
          id="new"
          type="password"
          autoComplete="new-password"
          required
          minLength={8}
          value={newPassword}
          onChange={(e) => setNewPassword(e.target.value)}
          className="mb-6 w-full rounded border border-vault-border bg-black/20 px-3 py-2 text-sm text-slate-100 outline-none focus:border-vault-accent"
        />

        {error && <p className="mb-4 text-sm text-red-400">{error}</p>}

        <button
          type="submit"
          disabled={submitting}
          className="w-full rounded bg-vault-accent px-3 py-2 text-sm font-medium text-white disabled:opacity-50"
        >
          {submitting ? "Saving..." : "Set new password"}
        </button>
      </form>
    </main>
  );
}
