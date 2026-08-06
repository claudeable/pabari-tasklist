"use client";
import { useEffect, useState, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";

const HUB = process.env.NEXT_PUBLIC_PABARI_URL ?? "https://pabari-workspace.up.railway.app";

function SsoContent() {
  const router = useRouter();
  const params = useSearchParams();
  const [error, setError] = useState("");

  useEffect(() => {
    const token = params.get("token");
    if (!token) { setError("No SSO token. Launch Pabari Shelf from the Workspace hub."); return; }

    fetch("/api/auth/sso", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ token }),
    })
      .then(async r => {
        if (!r.ok) { const d = await r.json().catch(() => ({})); throw new Error(d.error ?? "SSO failed"); }
        return r.json();
      })
      .then(() => router.push("/files"))
      .catch((e: Error) => setError(e.message));
  }, [params, router]);

  return (
    <div style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", background: "#f8fafc" }}>
      <div style={{
        background: "white", borderRadius: 16, padding: "48px 40px", textAlign: "center",
        boxShadow: "0 4px 32px rgba(0,0,0,0.08)", width: "100%", maxWidth: 380,
      }}>
        <div style={{ fontSize: 40, marginBottom: 16 }}>📁</div>
        <h1 style={{ fontSize: 20, fontWeight: 800, color: "#0f172a", marginBottom: 8 }}>Pabari Shelf</h1>

        {!error ? (
          <>
            <p style={{ color: "#64748b", fontSize: 13, marginBottom: 24 }}>
              Signing you in via Pabari Workspace…
            </p>
            <div style={{
              width: 28, height: 28, margin: "0 auto",
              border: "3px solid rgba(99,102,241,0.2)", borderTopColor: "#6366f1",
              borderRadius: "50%", animation: "spin 0.8s linear infinite",
            }} />
            <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
          </>
        ) : (
          <>
            <p style={{ color: "#dc2626", fontSize: 13, marginBottom: 20 }}>{error}</p>
            <a href={HUB} style={{ fontSize: 13, color: "#64748b", textDecoration: "underline" }}>
              ← Back to Pabari Workspace
            </a>
          </>
        )}
      </div>
    </div>
  );
}

export default function SsoPage() {
  return <Suspense><SsoContent /></Suspense>;
}
