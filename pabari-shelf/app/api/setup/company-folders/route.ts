import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { queryOne, query } from "@/lib/db";

const COMPANIES = [
  { name: "Berlin Equipment Ltd",              color: "#2563eb" },
  { name: "Doctor Pharma (K) Limited",         color: "#16a34a" },
  { name: "Getwell Health Pharma Ltd",         color: "#0891b2" },
  { name: "KISCOL",                            color: "#d97706" },
  { name: "Mali Credit Limited",               color: "#7c3aed" },
  { name: "Mayfair Aviation Ltd",              color: "#0f172a" },
  { name: "Maxi Tower Ltd",                    color: "#dc2626" },
  { name: "Pabari Investments Limited",        color: "#b5833a" },
  { name: "Safety Auto Spares (E.A) Limited",  color: "#db2777" },
  { name: "Topnotch Investment Holding Limited", color: "#6366f1" },
  { name: "Uni Supplies & Marketing (K) Ltd",  color: "#22c55e" },
  { name: "Unifresh Exotics (K) Limited",      color: "#f59e0b" },
];

const SUBFOLDERS = [
  { name: "Legal & Compliance",   color: "#dc2626" },
  { name: "Contracts & Leases",   color: "#2563eb" },
  { name: "Finance & Accounting", color: "#16a34a" },
  { name: "HR & Personnel",       color: "#db2777" },
  { name: "Correspondence",       color: "#0891b2" },
  { name: "Insurance",            color: "#7c3aed" },
  { name: "Operations",           color: "#d97706" },
];

async function createFolder(name: string, color: string, parentId: string | null, email: string): Promise<string> {
  const row = await queryOne<{ id: string }>(
    `INSERT INTO shelf_folders (name, color, parent_id, created_by) VALUES ($1, $2, $3, $4) RETURNING id`,
    [name, color, parentId, email]
  );
  return row!.id;
}

export async function POST() {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  // Check which company folders already exist at root
  const existing = await query<{ name: string }>(
    `SELECT name FROM shelf_folders WHERE parent_id IS NULL`
  );
  const existingNames = new Set(existing.map(r => r.name));

  let created = 0;
  for (const company of COMPANIES) {
    if (existingNames.has(company.name)) continue;
    const companyId = await createFolder(company.name, company.color, null, session.email);
    for (const sub of SUBFOLDERS) {
      await createFolder(sub.name, sub.color, companyId, session.email);
    }
    created++;
  }

  return NextResponse.json({ ok: true, created, skipped: COMPANIES.length - created });
}
