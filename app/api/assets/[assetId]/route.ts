import { NextResponse } from "next/server";
import { authenticationRequiredResponse, getAuthenticatedUser } from "@/core/auth/session";
import { CREATIVE_ASSET_BUCKET } from "@/core/assets/contracts";
import { createServerSupabaseClient } from "@/lib/supabase/server";

type Context = { params: Promise<{ assetId: string }> };
const headers = { "Cache-Control": "no-store", "X-Content-Type-Options": "nosniff" };

export async function GET(request: Request, { params }: Context) {
  const user = await getAuthenticatedUser(request); if (!user) return authenticationRequiredResponse();
  const { assetId } = await params; const supabase = await createServerSupabaseClient(request);
  const { data } = await supabase.from("creative_asset_objects")
    .select("metadata, original_path, thumbnail_path").eq("user_id", user.id).eq("asset_id", assetId).maybeSingle();
  if (!data) return NextResponse.json({ error: "Asset not found." }, { status: 404, headers });
  const [original, thumbnail] = await Promise.all([
    supabase.storage.from(CREATIVE_ASSET_BUCKET).createSignedUrl(data.original_path, 60, { download: true }),
    data.thumbnail_path ? supabase.storage.from(CREATIVE_ASSET_BUCKET).createSignedUrl(data.thumbnail_path, 300) : null,
  ]);
  if (original.error || !original.data?.signedUrl) {
    return NextResponse.json({ error: "Asset binary is unavailable." }, { status: 410, headers });
  }
  return NextResponse.json({ metadata: data.metadata, originalUrl: original.data.signedUrl,
    ...(thumbnail?.data?.signedUrl ? { thumbnailUrl: thumbnail.data.signedUrl } : {}) }, { headers });
}

export async function DELETE(request: Request, { params }: Context) {
  const user = await getAuthenticatedUser(request); if (!user) return authenticationRequiredResponse();
  const { assetId } = await params; const supabase = await createServerSupabaseClient(request);
  const { data } = await supabase.from("creative_asset_objects")
    .select("original_path, thumbnail_path").eq("user_id", user.id).eq("asset_id", assetId).maybeSingle();
  if (!data) return new NextResponse(null, { status: 204, headers });
  const paths = [data.original_path, data.thumbnail_path].filter((path): path is string => Boolean(path));
  const removed = await supabase.storage.from(CREATIVE_ASSET_BUCKET).remove(paths);
  if (removed.error) return NextResponse.json({ error: "Asset deletion could not be completed." }, { status: 503, headers });
  const { error } = await supabase.from("creative_asset_objects").delete()
    .eq("user_id", user.id).eq("asset_id", assetId);
  if (error) return NextResponse.json({ error: "Asset metadata deletion could not be completed." }, { status: 503, headers });
  return new NextResponse(null, { status: 204, headers });
}

export async function PATCH(request: Request, { params }: Context) {
  const user = await getAuthenticatedUser(request); if (!user) return authenticationRequiredResponse();
  const { assetId } = await params;
  const body = await request.json().catch(() => null) as { metadata?: Record<string, unknown> } | null;
  if (!body?.metadata || body.metadata.id !== assetId || JSON.stringify(body.metadata).length > 8192) {
    return NextResponse.json({ error: "Invalid asset metadata." }, { status: 400, headers });
  }
  const supabase = await createServerSupabaseClient(request);
  const { data, error } = await supabase.from("creative_asset_objects").update({
    metadata: body.metadata, updated_at: new Date().toISOString(),
  }).eq("user_id", user.id).eq("asset_id", assetId).select("asset_id").maybeSingle();
  if (error) return NextResponse.json({ error: "Asset metadata update failed." }, { status: 503, headers });
  if (!data) return NextResponse.json({ error: "Asset not found." }, { status: 404, headers });
  return NextResponse.json({ updated: true }, { headers });
}
