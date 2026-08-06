import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { queryOne, execute } from "@/lib/db";

export async function GET(_req: NextRequest, { params }: { params: { id: string } }) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const file = await queryOne<{
    name: string; original_name: string; mime_type: string; file_data: Buffer;
  }>(
    `SELECT name, original_name, mime_type, file_data FROM shelf_files WHERE id = $1`,
    [params.id]
  );

  if (!file) return NextResponse.json({ error: "Not found" }, { status: 404 });

  return new NextResponse(file.file_data, {
    headers: {
      "Content-Type": file.mime_type,
      "Content-Disposition": `inline; filename="${encodeURIComponent(file.original_name)}"`,
    },
  });
}

export async function DELETE(_req: NextRequest, { params }: { params: { id: string } }) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  await execute(`DELETE FROM shelf_files WHERE id = $1`, [params.id]);
  return NextResponse.json({ ok: true });
}
