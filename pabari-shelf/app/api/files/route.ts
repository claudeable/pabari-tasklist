import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { query, execute } from "@/lib/db";

const MAX_SIZE = 25 * 1024 * 1024; // 25MB

export async function GET(req: NextRequest) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const folderId = req.nextUrl.searchParams.get("folderId") ?? null;
  const search   = req.nextUrl.searchParams.get("search")?.trim() ?? "";

  const files = await query<{
    id: string; name: string; original_name: string; mime_type: string;
    file_size: number; description: string | null; tags: string[];
    uploaded_by: string; created_at: string;
  }>(
    search
      ? `SELECT id, name, original_name, mime_type, file_size, description, tags, uploaded_by, created_at
         FROM shelf_files
         WHERE name ILIKE $1 OR original_name ILIKE $1 OR description ILIKE $1 OR $2 = ANY(tags)
         ORDER BY created_at DESC`
      : `SELECT id, name, original_name, mime_type, file_size, description, tags, uploaded_by, created_at
         FROM shelf_files
         WHERE ${folderId ? "folder_id = $1" : "folder_id IS NULL"}
         ORDER BY created_at DESC`,
    search ? [`%${search}%`, search] : folderId ? [folderId] : []
  );

  return NextResponse.json(files);
}

export async function POST(req: NextRequest) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const form = await req.formData();
  const file  = form.get("file") as File | null;
  const name  = (form.get("name") as string)?.trim();
  const desc  = (form.get("description") as string)?.trim() || null;
  const folderId = (form.get("folderId") as string) || null;

  if (!file || !name) return NextResponse.json({ error: "File and name required" }, { status: 400 });
  if (file.size > MAX_SIZE) return NextResponse.json({ error: "File too large (max 25MB)" }, { status: 400 });

  const buffer = Buffer.from(await file.arrayBuffer());

  await execute(
    `INSERT INTO shelf_files (folder_id, name, original_name, mime_type, file_size, file_data, description, uploaded_by)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
    [folderId, name, file.name, file.type || "application/octet-stream", buffer.length, buffer, desc, session.email]
  );

  return NextResponse.json({ ok: true }, { status: 201 });
}
