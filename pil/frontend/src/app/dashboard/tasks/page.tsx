"use client";

import { useEffect, useState } from "react";

import ModulePageShell from "@/components/ModulePageShell";
import TasksPanel from "@/components/TasksPanel";
import { ensureDefaultWorkspace } from "@/lib/workspace";

export default function TasksModulePage() {
  const [projectId, setProjectId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    ensureDefaultWorkspace()
      .then((ws) => setProjectId(ws.projectId))
      .catch((err) => setError(err instanceof Error ? err.message : "Failed to load workspace"));
  }, []);

  return (
    <ModulePageShell title="Tasks">
      {error && <p className="text-sm text-red-400">{error}</p>}
      {!projectId && !error && <p className="text-sm text-slate-400">Loading...</p>}
      {projectId && <TasksPanel projectId={projectId} />}
    </ModulePageShell>
  );
}
