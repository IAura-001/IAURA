import { NextResponse } from "next/server";
import { authenticationRequiredResponse, getAuthenticatedUser } from "@/core/auth/session";
import { CREATIVE_ASSET_BUCKET, creativeAssetPath, validateCreativeAssetUpload } from "@/core/assets/contracts";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { createAdminSupabaseClient } from "@/lib/supabase/admin";
import type { CreativeAssetMetadata } from "@/types/creative-studio";

const headers = { "Cache-Control": "no-store", "X-Content-Type-Options": "nosniff" };

export async function POST(request: Request) {
  const user = await getAuthenticatedUser(request); if (!user) return authenticationRequiredResponse();
  const form = await request.formData().catch(() => null);
  const original = form?.get("original"); const thumbnail = form?.get("thumbnail");
  const rawMetadata = form?.get("metadata");
  let metadata: CreativeAssetMetadata | null = null;
  try { metadata = typeof rawMetadata === "string" ? JSON.parse(rawMetadata) as CreativeAssetMetadata : null; }
  catch { metadata = null; }
  if (!metadata || !(original instanceof File) || (thumbnail !== null && !(thumbnail instanceof File))) {
    return NextResponse.json({ error: "Invalid asset upload." }, { status: 400, headers });
  }
  const validationError = validateCreativeAssetUpload(metadata, original, thumbnail);
  if (validationError) return NextResponse.json({ error: validationError }, { status: 400, headers });
  let admin: ReturnType<typeof createAdminSupabaseClient>;
  try { admin = createAdminSupabaseClient(); }
  catch { return NextResponse.json({ error: "Storage authorization is unavailable." }, { status: 503, headers }); }
  const storage = admin.storage.from(CREATIVE_ASSET_BUCKET);
  const supabase = await createServerSupabaseClient(request);
  const { data: project } = await supabase.from("projects").select("id").eq("user_id", user.id)
    .eq("id", metadata.projectId).maybeSingle();
  if (!project) return NextResponse.json({ error: "Project not found." }, { status: 404, headers });
  const originalPath = creativeAssetPath(user.id, metadata.projectId, metadata.id, "original");
  const thumbnailPath = thumbnail ? creativeAssetPath(user.id, metadata.projectId, metadata.id, "thumbnail") : null;
  const { data: existing } = await supabase.from("creative_asset_objects").select("asset_id, byte_size")
    .eq("user_id", user.id).eq("asset_id", metadata.id).maybeSingle();
  if (existing) {
    if (Number(existing.byte_size) !== original.size) return NextResponse.json({ error: "Asset identity conflict." }, { status: 409, headers });
    return NextResponse.json({ stored: true, deduplicated: true }, { status: 200, headers });
  }
  const { data: reservationId, error: reservationError } = await supabase.rpc("reserve_asset_storage", {
    requested_project_id: metadata.projectId, requested_asset_id: metadata.id,
    requested_bytes: original.size + (thumbnail?.size ?? 0),
  });
  if (reservationError?.code === "P0002") return NextResponse.json({ error: "This limit has been reached.",
    code: reservationError.message }, { status: 403, headers });
  if (reservationError || !reservationId) return NextResponse.json({ error: "Storage authorization is unavailable." }, { status: 503, headers });
  const releaseReservation = () => supabase.rpc("release_asset_storage", { reservation_id: reservationId });
  const uploaded: string[] = [];
  const originalUpload = await storage.upload(originalPath, original, { contentType: original.type, upsert: false });
  if (originalUpload.error) { await releaseReservation(); return NextResponse.json({ error: "Asset upload failed." }, { status: 503, headers }); }
  uploaded.push(originalPath);
  if (thumbnail && thumbnailPath) {
    const thumbnailUpload = await storage.upload(thumbnailPath, thumbnail, { contentType: thumbnail.type, upsert: false });
    if (thumbnailUpload.error) {
      await storage.remove(uploaded);
      await releaseReservation();
      return NextResponse.json({ error: "Thumbnail upload failed." }, { status: 503, headers });
    }
    uploaded.push(thumbnailPath);
  }
  const { error } = await supabase.rpc("finalize_asset_storage", {
    reservation_id: reservationId, requested_original_path: originalPath,
    requested_thumbnail_path: thumbnailPath, requested_mime_type: metadata.mimeType,
    requested_byte_size: original.size, requested_thumbnail_byte_size: thumbnail?.size ?? 0,
    requested_metadata: metadata,
  });
  if (error) {
    await storage.remove(uploaded);
    await releaseReservation();
    return NextResponse.json({ error: "Asset metadata persistence failed." }, { status: 503, headers });
  }
  return NextResponse.json({ stored: true }, { status: 201, headers });
}

export async function GET(request: Request) {
  const user = await getAuthenticatedUser(request); if (!user) return authenticationRequiredResponse();
  const projectId = new URL(request.url).searchParams.get("projectId")?.trim();
  if (!projectId) return NextResponse.json({ error: "Project scope required." }, { status: 400, headers });
  const supabase = await createServerSupabaseClient(request);
  const { data: project } = await supabase.from("projects").select("id").eq("user_id", user.id).eq("id", projectId).maybeSingle();
  if (!project) return NextResponse.json({ error: "Project not found." }, { status: 404, headers });
  const { data, error } = await supabase.from("creative_asset_objects")
    .select("asset_id, metadata, thumbnail_path, created_at").eq("user_id", user.id)
    .eq("project_id", projectId).order("created_at", { ascending: false }).limit(100);
  if (error) return NextResponse.json({ error: "Asset library unavailable." }, { status: 503, headers });
  const assets = await Promise.all((data ?? []).map(async (row) => {
    const signed = row.thumbnail_path ? await supabase.storage.from(CREATIVE_ASSET_BUCKET)
      .createSignedUrl(row.thumbnail_path, 300) : null;
    return { metadata: row.metadata, ...(signed?.data?.signedUrl ? { thumbnailUrl: signed.data.signedUrl } : {}) };
  }));
  return NextResponse.json({ assets }, { headers });
}
