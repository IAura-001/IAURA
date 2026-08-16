import { NextResponse } from "next/server";
import { authenticationRequiredResponse, getAuthenticatedUser } from "@/core/auth/session";
import { normalizeProject } from "@/core/project/ProjectRepository";
import { createServerSupabaseClient } from "@/lib/supabase/server";

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
  const { error } = await supabase.from("projects").insert({ id: project.id, user_id: user.id, data: project });
  if (error) return NextResponse.json({ error: "Unable to create project." }, { status: error.code === "23505" ? 409 : 500, headers });
  return NextResponse.json({ project }, { status: 201, headers });
}
