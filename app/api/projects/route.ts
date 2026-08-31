import { NextResponse } from "next/server";
import { authenticationRequiredResponse, getAuthenticatedUser } from "@/core/auth/session";
import { normalizeProject } from "@/core/project/ProjectRepository";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { recordProductEvent } from "@/core/betaUsage/record";

const headers = { "Cache-Control": "no-store" };

export async function GET() {
  const user = await getAuthenticatedUser();
  if (!user) return authenticationRequiredResponse();
  const supabase = await createServerSupabaseClient();
  const { data, error } = await supabase.from("projects").select("data").eq("user_id", user.id).order("updated_at", { ascending: false });
  if (error) return NextResponse.json({ error: "Unable to load projects." }, { status: 500, headers });
  return NextResponse.json({ projects: data.map((row) => row.data) }, { headers });
}

export async function POST(request: Request) {
  const user = await getAuthenticatedUser();
  if (!user) return authenticationRequiredResponse();
  const body = await request.json().catch(() => null) as { project?: unknown } | null;
  const project = normalizeProject(body?.project);
  if (!project) return NextResponse.json({ error: "Invalid project." }, { status: 400, headers });
  const supabase = await createServerSupabaseClient();
  const { data: created, error } = await supabase.rpc("create_project_with_entitlement", {
    requested_id: project.id, requested_data: project,
  });
  if (error?.code === "P0002") return NextResponse.json({ error: "This limit has been reached.",
    code: error.message === "PROJECT_LIMIT_REACHED" ? "PROJECT_LIMIT_REACHED" : "CAPABILITY_NOT_ALLOWED" },
    { status: 403, headers });
  if (error) return NextResponse.json({ error: "Unable to create project." }, { status: 503, headers });
  await recordProductEvent(supabase, {
    type: "project_created", projectId: project.id,
    eventKey: `project_created:${project.id}`, source: "project_form",
    sessionId: request.headers.get("X-VAEORA-Session-Id"),
    metadata: { identity_status: project.themeDNA || project.branding ? "custom" : "canonical" },
  });
  return NextResponse.json({ project }, { status: created ? 201 : 200, headers });
}
