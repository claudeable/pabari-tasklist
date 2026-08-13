"use client";

import { Suspense, useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";

import ModulePageShell from "@/components/ModulePageShell";
import TasksPanel from "@/components/TasksPanel";
import { ensureDefaultWorkspace } from "@/lib/workspace";

function TasksContent() {
  const [projectId, setProjectId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const searchParams = useSearchParams();
  const autoOpenForm = searchParams.get("new") === "1";

  useEffect(() => {
    ensureDefaultWorkspace()
      .then((ws) => setProjectId(ws.projectId))
      .catch((err) => setError(err instanceof Error ? err.message : "Failed to load workspace"));
  }, []);

  return (
    <>
      {error && <p className="text-sm text-red-400">{error}</p>}
      {!projectId && !error && <p className="text-sm text-slate-400">Loading...</p>}
      {projectId && <TasksPanel projectId={projectId} autoOpenForm={autoOpenForm} />}
    </>
  );
}

export default function TasksModulePage() {
  return (
    <ModulePageShell title="Tasks">
      <Suspense fallback={<p className="text-sm text-slate-400">Loading...</p>}>
        <TasksContent />
      </Suspense>
    </ModulePageShell>
  );
}
