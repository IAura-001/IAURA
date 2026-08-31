import { NextResponse } from "next/server";
import { authenticationRequiredResponse, getAuthenticatedUser } from "@/core/auth/session";
import { CREATIVE_ASSET_BUCKET } from "@/core/assets/contracts";
import { createAdminSupabaseClient } from "@/lib/supabase/admin";
import { createServerSupabaseClient } from "@/lib/supabase/server";

export async function DELETE(request: Request) {
  const user = await getAuthenticatedUser(request); if (!user) return authenticationRequiredResponse();
  const body = await request.json().catch(() => null) as { confirmation?: unknown } | null;
  if (body?.confirmation !== "DELETE MY ACCOUNT") {
    return NextResponse.json({ error: "Explicit confirmation required." }, { status: 400 });
  }
  const supabase = await createServerSupabaseClient(request);
  const { data: assets, error: inventoryError } = await supabase.from("creative_asset_objects")
    .select("original_path, thumbnail_path").eq("user_id", user.id);
  if (inventoryError) return NextResponse.json({ error: "Account cleanup could not begin." }, { status: 503 });
  const paths = (assets ?? []).flatMap((asset) => [asset.original_path, asset.thumbnail_path])
    .filter((path): path is string => Boolean(path));
  if (paths.length) {
    const removed = await supabase.storage.from(CREATIVE_ASSET_BUCKET).remove(paths);
    if (removed.error) return NextResponse.json({ error: "Cloud assets could not be deleted." }, { status: 503 });
  }
  try {
    const admin = createAdminSupabaseClient(); const deleted = await admin.auth.admin.deleteUser(user.id);
    if (deleted.error) return NextResponse.json({ error: "Account deletion failed." }, { status: 503 });
    await supabase.auth.signOut();
    return NextResponse.json({ deleted: true }, { headers: { "Cache-Control": "no-store" } });
  } catch {
    return NextResponse.json({ error: "Account deletion is unavailable." }, { status: 503 });
  }
}
