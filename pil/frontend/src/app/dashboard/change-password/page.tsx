"use client";

import { useState } from "react";

import ModulePageShell from "@/components/ModulePageShell";
import { apiFetch } from "@/lib/api-client";

export default function DashboardChangePasswordPage() {
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setSuccess(false);
    setSubmitting(true);
    try {
      // No bearerToken override here — this relies on the normal session access
      // token, since the user is already fully logged in. This is a voluntary,
      // self-service action, not the forced first-login flow.
      await apiFetch("/api/v1/auth/password/change", {
        method: "POST",
        body: JSON.stringify({ current_password: currentPassword, new_password: newPassword }),
      });
      setCurrentPassword("");
      setNewPassword("");
      setSuccess(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not change password");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <ModulePageShell title="Change Password">
      <form
        onSubmit={handleSubmit}
        className="max-w-sm rounded-xl border border-vault-border bg-vault-surface2 p-6"
      >
        {success && (
          <p className="mb-4 rounded-lg border border-vault-success/30 bg-vault-success/10 px-3 py-2 text-sm text-vault-success">
            Password updated.
          </p>
        )}
        {error && (
          <p className="mb-4 rounded-lg border border-vault-danger/30 bg-vault-danger/10 px-3 py-2 text-sm text-vault-danger">
            {error}
          </p>
        )}

        <label className="mb-1 block text-sm text-slate-300" htmlFor="current">
          Current password
        </label>
        <input
          id="current"
          type="password"
          autoComplete="current-password"
          required
          value={currentPassword}
          onChange={(e) => setCurrentPassword(e.target.value)}
          className="mb-4 w-full rounded-lg border border-vault-border bg-vault-bg px-3 py-2 text-sm text-slate-100 outline-none focus:border-vault-accent"
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
          className="mb-6 w-full rounded-lg border border-vault-border bg-vault-bg px-3 py-2 text-sm text-slate-100 outline-none focus:border-vault-accent"
        />

        <button
          type="submit"
          disabled={submitting}
          className="rounded-lg bg-gradient-to-r from-vault-accent to-vault-accent2 px-4 py-2 text-sm font-medium text-white disabled:opacity-50"
        >
          {submitting ? "Saving..." : "Update password"}
        </button>
      </form>
    </ModulePageShell>
  );
}
