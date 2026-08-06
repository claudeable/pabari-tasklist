import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth";
import { query } from "@/lib/db";
import ShelfBrowser from "@/components/ShelfBrowser";

export const dynamic = "force-dynamic";

type Folder = { id: string; name: string; color: string; file_count: string };
type ShelfFile = {
  id: string; name: string; original_name: string; mime_type: string;
  file_size: number; description: string | null; uploaded_by: string; created_at: string;
};
type Crumb = { id: string; name: string; parent_id: string | null };

export default async function FilesPage({
  searchParams,
}: {
  searchParams: Promise<{ folder?: string; search?: string; view?: string }>;
}) {
  const session = await getSession();
  if (!session) redirect("/sso");

  const sp = await searchParams;
  const folderId = sp.folder ?? null;
  const search   = sp.search?.trim() ?? "";
  const view     = sp.view === "list" ? "list" : "grid";

  const [folders, files, breadcrumb, allFolders] = await Promise.all([
    // Sub-folders
    query<Folder>(
      `SELECT f.id, f.name, f.color, COUNT(sf.id) AS file_count
       FROM shelf_folders f
       LEFT JOIN shelf_files sf ON sf.folder_id = f.id
       WHERE ${folderId ? "f.parent_id = $1" : "f.parent_id IS NULL"}
       GROUP BY f.id ORDER BY f.name`,
      folderId ? [folderId] : []
    ),

    // Files
    search
      ? query<ShelfFile>(
          `SELECT id, name, original_name, mime_type, file_size, description, uploaded_by, created_at
           FROM shelf_files
           WHERE name ILIKE $1 OR original_name ILIKE $1 OR description ILIKE $1
           ORDER BY created_at DESC`,
          [`%${search}%`]
        )
      : query<ShelfFile>(
          `SELECT id, name, original_name, mime_type, file_size, description, uploaded_by, created_at
           FROM shelf_files
           WHERE ${folderId ? "folder_id = $1" : "folder_id IS NULL"}
           ORDER BY created_at DESC`,
          folderId ? [folderId] : []
        ),

    // Breadcrumb
    folderId
      ? query<Crumb>(
          `WITH RECURSIVE crumb AS (
             SELECT id, name, parent_id FROM shelf_folders WHERE id = $1
             UNION ALL
             SELECT f.id, f.name, f.parent_id FROM shelf_folders f JOIN crumb c ON c.parent_id = f.id
           )
           SELECT id, name, parent_id FROM crumb ORDER BY parent_id NULLS FIRST`,
          [folderId]
        )
      : Promise.resolve([] as Crumb[]),

    // All folders (for upload destination picker)
    query<{ id: string; name: string }>(`SELECT id, name FROM shelf_folders ORDER BY name`),
  ]);

  return (
    <ShelfBrowser
      user={session}
      folderId={folderId}
      folders={folders}
      files={files}
      breadcrumb={breadcrumb}
      allFolders={allFolders}
      search={search}
      view={view}
    />
  );
}
