"use client";

import { Suspense, useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";

import DocumentsPanel from "@/components/DocumentsPanel";
import ModulePageShell from "@/components/ModulePageShell";
import { ensureDefaultWorkspace } from "@/lib/workspace";

function DocumentsContent() {
  const [projectId, setProjectId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const searchParams = useSearchParams();
  const autoOpenUpload = searchParams.get("upload") === "1";

  useEffect(() => {
    ensureDefaultWorkspace()
      .then((ws) => setProjectId(ws.projectId))
      .catch((err) => setError(err instanceof Error ? err.message : "Failed to load workspace"));
  }, []);

  return (
    <>
      {error && <p className="text-sm text-red-400">{error}</p>}
      {!projectId && !error && <p className="text-sm text-slate-400">Loading...</p>}
      {projectId && <DocumentsPanel projectId={projectId} autoOpenUpload={autoOpenUpload} />}
    </>
  );
}

export default function DocumentsModulePage() {
  return (
    <ModulePageShell title="Documents">
      <Suspense fallback={<p className="text-sm text-slate-400">Loading...</p>}>
        <DocumentsContent />
      </Suspense>
    </ModulePageShell>
  );
}
