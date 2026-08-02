"use client";

import { ReactNode } from "react";

export default function ModulePageShell({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div className="px-4 py-6 sm:px-6 sm:py-8">
      <div className="mx-auto max-w-5xl">
        <h1 className="mb-6 text-2xl font-bold text-slate-100">{title}</h1>
        {children}
      </div>
    </div>
  );
}
