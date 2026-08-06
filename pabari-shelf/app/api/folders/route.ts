import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { query, execute } from "@/lib/db";

export async function GET(req: NextRequest) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const parentId = req.nextUrl.searchParams.get("parentId") ?? null;

  const folders = await query<{ id: string; name: string; color: string; file_count: string }>(
    `SELECT f.id, f.name, f.color,
            COUNT(sf.id) AS file_count
     FROM shelf_folders f
     LEFT JOIN shelf_files sf ON sf.folder_id = f.id
     WHERE ${parentId ? "f.parent_id = $1" : "f.parent_id IS NULL"}
     GROUP BY f.id
     ORDER BY f.name`,
    parentId ? [parentId] : []
  );

  return NextResponse.json(folders);
}

export async function POST(req: NextRequest) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { name, parentId, color } = await req.json();
  if (!name?.trim()) return NextResponse.json({ error: "Name required" }, { status: 400 });

  await execute(
    `INSERT INTO shelf_folders (name, parent_id, color, created_by) VALUES ($1, $2, $3, $4)`,
    [name.trim(), parentId || null, color || "#6366f1", session.email]
  );

  return NextResponse.json({ ok: true }, { status: 201 });
}
