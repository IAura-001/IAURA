import { NextResponse } from "next/server";
import { authenticationRequiredResponse, getAuthenticatedUser } from "@/core/auth/session";
import { normalizeProject } from "@/core/project/ProjectRepository";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { persistedLaunchMilestones } from "@/core/betaUsage/funnel";
import { recordProductEvent } from "@/core/betaUsage/record";
import { CREATIVE_ASSET_BUCKET } from "@/core/assets/contracts";

const headers = { "Cache-Control": "no-store" };
type Context = { params: Promise<{ projectId: string }> };

export async function GET(_: Request, { params }: Context) {
  const user = await getAuthenticatedUser(); if (!user) return authenticationRequiredResponse();
  const { projectId } = await params; const supabase = await createServerSupabaseClient();
  const { data, error } = await supabase.from("projects").select("data").eq("user_id", user.id).eq("id", projectId).maybeSingle();
  if (error) return NextResponse.json({ error: "Unable to load project." }, { status: 500, headers });
  if (!data) return NextResponse.json({ error: "Project not found." }, { status: 404, headers });
  return NextResponse.json({ project: data.data }, { headers });
}

export async function PUT(request: Request, { params }: Context) {
  const user = await getAuthenticatedUser(); if (!user) return authenticationRequiredResponse();
  const { projectId } = await params; const body = await request.json().catch(() => null) as { project?: unknown } | null;
  const project = normalizeProject(body?.project);
  if (!project || project.id !== projectId) return NextResponse.json({ error: "Invalid project." }, { status: 400, headers });
  const supabase = await createServerSupabaseClient();
  const { data, error } = await supabase.from("projects").update({ data: project }).eq("user_id", user.id).eq("id", projectId).select("id").maybeSingle();
  if (error) return NextResponse.json({ error: "Unable to update project." }, { status: 500, headers });
  if (!data) return NextResponse.json({ error: "Project not found." }, { status: 404, headers });
  await Promise.all(persistedLaunchMilestones(project).map((durableKind) =>
    recordProductEvent(supabase, {
      type: "durable_output", projectId,
      eventKey: `durable:${projectId}:${durableKind}`,
      sessionId: request.headers.get("X-VAEORA-Session-Id"),
      source: "project_persistence", metadata: { durable_kind: durableKind },
    }),
  ));
  return NextResponse.json({ project }, { headers });
}

export async function DELETE(_: Request, { params }: Context) {
  const user = await getAuthenticatedUser(); if (!user) return authenticationRequiredResponse();
  const { projectId } = await params; const supabase = await createServerSupabaseClient();
  const { data: assets, error: inventoryError } = await supabase.from("creative_asset_objects")
    .select("original_path, thumbnail_path").eq("user_id", user.id).eq("project_id", projectId);
  if (inventoryError) return NextResponse.json({ error: "Unable to inspect project assets." }, { status: 503, headers });
  const paths = (assets ?? []).flatMap((asset) => [asset.original_path, asset.thumbnail_path])
    .filter((path): path is string => Boolean(path));
  if (paths.length) {
    const removed = await supabase.storage.from(CREATIVE_ASSET_BUCKET).remove(paths);
    if (removed.error) return NextResponse.json({ error: "Unable to delete project assets." }, { status: 503, headers });
  }
  const { data, error } = await supabase.from("projects").delete().eq("user_id", user.id).eq("id", projectId).select("id").maybeSingle();
  if (error) return NextResponse.json({ error: "Unable to delete project." }, { status: 500, headers });
  if (!data) return NextResponse.json({ error: "Project not found." }, { status: 404, headers });
  return new NextResponse(null, { status: 204, headers });
}
