"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";

import { apiFetch, ApiError } from "@/lib/api-client";

interface MeResponse {
  id: string;
  alias: string;
}

interface OrganizationResponse {
  id: string;
  name: string;
  slug: string;
  status: string;
  created_at: string;
}

export default function OrganizationsPage() {
  const router = useRouter();
  const [me, setMe] = useState<MeResponse | null>(null);
  const [orgs, setOrgs] = useState<OrganizationResponse[] | null>(null);
  const [name, setName] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);

  useEffect(() => {
    Promise.all([apiFetch<MeResponse>("/api/v1/users/me"), apiFetch<OrganizationResponse[]>("/api/v1/organizations")])
      .then(([meResp, orgsResp]) => {
        setMe(meResp);
        setOrgs(orgsResp);
      })
      .catch((err) => {
        if (err instanceof ApiError && err.status === 401) {
          router.replace("/login");
          return;
        }
        setError(err instanceof Error ? err.message : "Failed to load organizations");
      });
  }, [router]);

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    if (!me || !name.trim()) return;
    setCreating(true);
    setError(null);
    try {
      const org = await apiFetch<OrganizationResponse>("/api/v1/organizations", {
        method: "POST",
        body: JSON.stringify({ name: name.trim(), initial_admin_user_id: me.id }),
      });
      setOrgs((prev) => [...(prev ?? []), org]);
      setName("");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to create organization");
    } finally {
      setCreating(false);
    }
  }

  return (
    <main className="min-h-screen px-6 py-10">
      <div className="mx-auto max-w-2xl">
        <div className="mb-8 flex items-center justify-between">
          <h1 className="text-lg font-semibold text-slate-100">Organizations</h1>
          <Link href="/home" className="text-sm text-slate-400 hover:text-vault-accent">
            Back
          </Link>
        </div>

        {error && <p className="mb-4 text-sm text-red-400">{error}</p>}

        {orgs === null ? (
          <p className="text-sm text-slate-400">Loading...</p>
        ) : (
          <div className="mb-8 space-y-2">
            {orgs.length === 0 && <p className="text-sm text-slate-500">No organizations yet.</p>}
            {orgs.map((org) => (
              <Link
                key={org.id}
                href={`/orgs/${org.id}`}
                className="block rounded-lg border border-vault-border bg-vault-surface p-4 hover:border-vault-accent"
              >
                <p className="text-sm font-medium text-slate-100">{org.name}</p>
                <p className="text-xs text-slate-500">{org.slug}</p>
              </Link>
            ))}
          </div>
        )}

        <form onSubmit={handleCreate} className="rounded-lg border border-vault-border bg-vault-surface p-4">
          <p className="mb-3 text-sm font-medium text-slate-200">Create organization</p>
          <div className="flex gap-2">
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Organization name"
              className="flex-1 rounded border border-vault-border bg-transparent px-3 py-1.5 text-sm text-slate-100"
            />
            <button
              type="submit"
              disabled={creating || !name.trim()}
              className="rounded bg-vault-accent px-3 py-1.5 text-sm text-white disabled:opacity-50"
            >
              Create
            </button>
          </div>
        </form>
      </div>
    </main>
  );
}
