"use client";

import { useEffect, useState } from "react";

import ModulePageShell from "@/components/ModulePageShell";
import { apiFetch } from "@/lib/api-client";
import { ensureDefaultWorkspace } from "@/lib/workspace";

interface MeResponse {
  id: string;
  alias: string;
  system_role: string;
}

interface AdminCreateUserResponse {
  id: string;
  alias: string;
  one_time_password: string;
}

export default function AdminPage() {
  const [me, setMe] = useState<MeResponse | null>(null);
  const [alias, setAlias] = useState("");
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [created, setCreated] = useState<AdminCreateUserResponse | null>(null);

  useEffect(() => {
    apiFetch<MeResponse>("/api/v1/users/me").then(setMe).catch(() => {});
  }, []);

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    if (!alias.trim()) return;
    setCreating(true);
    setError(null);
    setCreated(null);
    try {
      const user = await apiFetch<AdminCreateUserResponse>("/api/v1/admin/users", {
        method: "POST",
        body: JSON.stringify({ alias: alias.trim(), system_role: "member" }),
      });

      // The admin endpoint only creates the account — it isn't automatically a
      // member of this workspace's org/project, so without this it would create
      // its own isolated workspace on first login instead of joining this one.
      const ws = await ensureDefaultWorkspace();
      await apiFetch(`/api/v1/organizations/${ws.organizationId}/members`, {
        method: "POST",
        body: JSON.stringify({ user_id: user.id, role: "member" }),
      }).catch(() => {});
      await apiFetch(`/api/v1/projects/${ws.projectId}/members`, {
        method: "POST",
        body: JSON.stringify({ user_id: user.id, role: "member" }),
      }).catch(() => {});

      setCreated(user);
      setAlias("");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to create user");
    } finally {
      setCreating(false);
    }
  }

  if (me && me.system_role !== "system_admin") {
    return (
      <ModulePageShell title="Admin">
        <p className="text-sm text-slate-400">Only the Admin account can access this page.</p>
      </ModulePageShell>
    );
  }

  return (
    <ModulePageShell title="Admin">
      <form
        onSubmit={handleCreate}
        className="max-w-md space-y-3 rounded-xl border border-vault-border bg-vault-surface2 p-5"
      >
        <p className="text-sm font-semibold text-slate-200">Create New User</p>
        <input
          value={alias}
          onChange={(e) => setAlias(e.target.value)}
          placeholder="Alias (e.g. Falcon-03)"
          className="w-full rounded-lg border border-vault-border bg-vault-bg px-3 py-2 text-sm text-slate-100 focus:border-vault-accent focus:outline-none"
        />
        <button
          type="submit"
          disabled={creating || !alias.trim()}
          className="w-full rounded-lg bg-gradient-to-r from-vault-accent to-vault-accent2 px-4 py-2 text-sm font-medium text-white disabled:opacity-50"
        >
          {creating ? "Creating..." : "Create User"}
        </button>
      </form>

      {error && (
        <p className="mt-3 max-w-md rounded-lg border border-vault-danger/30 bg-vault-danger/10 px-3 py-2 text-sm text-vault-danger">
          {error}
        </p>
      )}

      {created && (
        <div className="mt-4 max-w-md rounded-lg border border-vault-success/30 bg-vault-success/10 p-4">
          <p className="mb-2 text-sm font-medium text-vault-success">Account created — relay these once, out-of-band:</p>
          <p className="text-sm text-slate-200">
            Alias: <span className="font-mono font-semibold">{created.alias}</span>
          </p>
          <p className="text-sm text-slate-200">
            Password: <span className="font-mono font-semibold">{created.one_time_password}</span>
          </p>
        </div>
      )}
    </ModulePageShell>
  );
}
