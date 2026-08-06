import { NextResponse } from "next/server";
import { createSession } from "@/lib/auth";
import { migrate } from "@/lib/db";

const HUB_VALIDATE = process.env.PABARI_HUB_URL
  ? `${process.env.PABARI_HUB_URL}/api/sso/validate`
  : "https://pabari-workspace.up.railway.app/api/sso/validate";

export async function POST(req: Request) {
  const { token } = await req.json().catch(() => ({})) as { token?: string };
  if (!token) return NextResponse.json({ error: "Missing token" }, { status: 400 });

  // Validate with the hub
  const res = await fetch(HUB_VALIDATE, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ token }),
  }).catch(() => null);

  if (!res?.ok) {
    const msg = await res?.json().catch(() => ({})) as { error?: string };
    return NextResponse.json({ error: msg?.error ?? "SSO validation failed" }, { status: 401 });
  }

  const user = await res.json() as { email: string; name: string; role: string };

  // Ensure tables exist (idempotent)
  await migrate().catch(() => {});

  await createSession({ email: user.email, name: user.name, role: user.role });
  return NextResponse.json({ ok: true });
}
