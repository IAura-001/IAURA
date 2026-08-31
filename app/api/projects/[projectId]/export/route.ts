import { authenticationRequiredResponse, getAuthenticatedUser } from "@/core/auth/session";
import { CREATIVE_ASSET_BUCKET } from "@/core/assets/contracts";
import { createStoredZip, projectExportManifest, type ExportAssetRecord } from "@/core/export/projectExport";
import { normalizeProject } from "@/core/project/ProjectRepository";
import { createServerSupabaseClient } from "@/lib/supabase/server";

type Context = { params: Promise<{ projectId: string }> };
export async function GET(request: Request, { params }: Context) {
  const user = await getAuthenticatedUser(request); if (!user) return authenticationRequiredResponse();
  const { projectId } = await params; const supabase = await createServerSupabaseClient(request);
  const { data: row } = await supabase.from("projects").select("data").eq("user_id", user.id).eq("id", projectId).maybeSingle();
  const project = normalizeProject(row?.data);
  if (!project) return Response.json({ error: "Project not found." }, { status: 404 });
  const { data: assetRows } = await supabase.from("creative_asset_objects")
    .select("metadata, original_path").eq("user_id", user.id).eq("project_id", projectId).order("asset_id");
  const exportAssets: ExportAssetRecord[] = []; const files: Array<{ name: string; data: Uint8Array }> = [];
  for (const asset of assetRows ?? []) {
    const downloaded = await supabase.storage.from(CREATIVE_ASSET_BUCKET).download(asset.original_path);
    const available = Boolean(downloaded.data && !downloaded.error);
    exportAssets.push({ metadata: asset.metadata, originalPath: asset.original_path, available });
    if (downloaded.data) files.push({ name: `assets/${asset.metadata.id}.${asset.metadata.mimeType.split("/")[1]}`,
      data: new Uint8Array(await downloaded.data.arrayBuffer()) });
  }
  const manifest = projectExportManifest(project, exportAssets);
  files.unshift({ name: "manifest.json", data: new TextEncoder().encode(JSON.stringify(manifest, null, 2)) });
  const archive = createStoredZip(files);
  return new Response(archive.buffer.slice(archive.byteOffset, archive.byteOffset + archive.byteLength) as ArrayBuffer, { headers: {
    "Content-Type": "application/zip", "Content-Disposition": `attachment; filename="vaeora-project-${project.id}.zip"`,
    "Cache-Control": "no-store", "X-Content-Type-Options": "nosniff",
  } });
}
