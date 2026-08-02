"use client";

import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useEffect, useState } from "react";

import { apiFetch, ApiError } from "@/lib/api-client";

interface ProjectResponse {
  id: string;
  organization_id: string;
  name: string;
  description: string | null;
  created_at: string;
}

export default function ProjectsPage() {
  const router = useRouter();
  const params = useParams<{ orgId: string }>();
  const orgId = params.orgId;

  const [projects, setProjects] = useState<ProjectResponse[] | null>(null);
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);

  useEffect(() => {
    apiFetch<ProjectResponse[]>(`/api/v1/organizations/${orgId}/projects`)
      .then(setProjects)
      .catch((err) => {
        if (err instanceof ApiError && err.status === 401) {
          router.replace("/login");
          return;
        }
        setError(err instanceof Error ? err.message : "Failed to load projects");
      });
  }, [orgId, router]);

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim()) return;
    setCreating(true);
    setError(null);
    try {
      const project = await apiFetch<ProjectResponse>(`/api/v1/organizations/${orgId}/projects`, {
        method: "POST",
        body: JSON.stringify({ name: name.trim(), description: description.trim() || null }),
      });
      setProjects((prev) => [...(prev ?? []), project]);
      setName("");
      setDescription("");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to create project");
    } finally {
      setCreating(false);
    }
  }

  return (
    <main className="min-h-screen px-6 py-10">
      <div className="mx-auto max-w-2xl">
        <div className="mb-8 flex items-center justify-between">
          <h1 className="text-lg font-semibold text-slate-100">Projects</h1>
          <Link href="/orgs" className="text-sm text-slate-400 hover:text-vault-accent">
            Back
          </Link>
        </div>

        {error && <p className="mb-4 text-sm text-red-400">{error}</p>}

        {projects === null ? (
          <p className="text-sm text-slate-400">Loading...</p>
        ) : (
          <div className="mb-8 space-y-2">
            {projects.length === 0 && <p className="text-sm text-slate-500">No projects yet.</p>}
            {projects.map((project) => (
              <Link
                key={project.id}
                href={`/orgs/${orgId}/projects/${project.id}`}
                className="block rounded-lg border border-vault-border bg-vault-surface p-4 hover:border-vault-accent"
              >
                <p className="text-sm font-medium text-slate-100">{project.name}</p>
                {project.description && <p className="text-xs text-slate-500">{project.description}</p>}
              </Link>
            ))}
          </div>
        )}

        <form onSubmit={handleCreate} className="space-y-2 rounded-lg border border-vault-border bg-vault-surface p-4">
          <p className="mb-1 text-sm font-medium text-slate-200">Create project</p>
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Project name"
            className="w-full rounded border border-vault-border bg-transparent px-3 py-1.5 text-sm text-slate-100"
          />
          <input
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="Description (optional)"
            className="w-full rounded border border-vault-border bg-transparent px-3 py-1.5 text-sm text-slate-100"
          />
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
