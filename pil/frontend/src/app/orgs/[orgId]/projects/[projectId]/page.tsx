"use client";

import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useEffect, useState } from "react";

import { apiFetch, ApiError } from "@/lib/api-client";

interface ChannelResponse {
  id: string;
  project_id: string;
  name: string;
  is_private: boolean;
  created_at: string;
}

export default function ChannelsPage() {
  const router = useRouter();
  const params = useParams<{ orgId: string; projectId: string }>();
  const { orgId, projectId } = params;

  const [channels, setChannels] = useState<ChannelResponse[] | null>(null);
  const [name, setName] = useState("");
  const [isPrivate, setIsPrivate] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);

  useEffect(() => {
    apiFetch<ChannelResponse[]>(`/api/v1/projects/${projectId}/channels`)
      .then(setChannels)
      .catch((err) => {
        if (err instanceof ApiError && err.status === 401) {
          router.replace("/login");
          return;
        }
        setError(err instanceof Error ? err.message : "Failed to load channels");
      });
  }, [projectId, router]);

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim()) return;
    setCreating(true);
    setError(null);
    try {
      const channel = await apiFetch<ChannelResponse>(`/api/v1/projects/${projectId}/channels`, {
        method: "POST",
        body: JSON.stringify({ name: name.trim(), is_private: isPrivate }),
      });
      setChannels((prev) => [...(prev ?? []), channel]);
      setName("");
      setIsPrivate(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to create channel");
    } finally {
      setCreating(false);
    }
  }

  return (
    <main className="min-h-screen px-6 py-10">
      <div className="mx-auto max-w-2xl">
        <div className="mb-8 flex items-center justify-between">
          <h1 className="text-lg font-semibold text-slate-100">Channels</h1>
          <Link href={`/orgs/${orgId}`} className="text-sm text-slate-400 hover:text-vault-accent">
            Back
          </Link>
        </div>

        {error && <p className="mb-4 text-sm text-red-400">{error}</p>}

        {channels === null ? (
          <p className="text-sm text-slate-400">Loading...</p>
        ) : (
          <div className="mb-8 space-y-2">
            {channels.length === 0 && <p className="text-sm text-slate-500">No channels yet.</p>}
            {channels.map((channel) => (
              <Link
                key={channel.id}
                href={`/orgs/${orgId}/projects/${projectId}/channels/${channel.id}`}
                className="block rounded-lg border border-vault-border bg-vault-surface p-4 hover:border-vault-accent"
              >
                <p className="text-sm font-medium text-slate-100">
                  #{channel.name} {channel.is_private && <span className="text-xs text-slate-500">(private)</span>}
                </p>
              </Link>
            ))}
          </div>
        )}

        <form onSubmit={handleCreate} className="space-y-2 rounded-lg border border-vault-border bg-vault-surface p-4">
          <p className="mb-1 text-sm font-medium text-slate-200">Create channel</p>
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Channel name"
            className="w-full rounded border border-vault-border bg-transparent px-3 py-1.5 text-sm text-slate-100"
          />
          <label className="flex items-center gap-2 text-sm text-slate-300">
            <input type="checkbox" checked={isPrivate} onChange={(e) => setIsPrivate(e.target.checked)} />
            Private
          </label>
          <button
            type="submit"
            disabled={creating || !name.trim()}
            className="rounded bg-vault-accent px-3 py-1.5 text-sm text-white disabled:opacity-50"
          >
            Create
          </button>
        </form>
      </div>
    </main>
  );
}
