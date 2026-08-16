import { NextResponse } from "next/server";
import { authenticationRequiredResponse, getAuthenticatedUser } from "@/core/auth/session";
import { normalizeProject } from "@/core/project/ProjectRepository";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import type { IAuraProject } from "@/core/project/types";

export async function POST(request: Request) {
  if (process.env.NODE_ENV === "production") return new NextResponse(null, { status: 404 });
  const user = await getAuthenticatedUser(); if (!user) return authenticationRequiredResponse();
  const body = await request.json().catch(() => null) as { projects?: unknown } | null;
  if (!Array.isArray(body?.projects) || body.projects.length > 500) return NextResponse.json({ error: "Invalid import." }, { status: 400 });
  const projects = body.projects.map(normalizeProject).filter((p): p is IAuraProject => Boolean(p));
  if (projects.length !== body.projects.length) return NextResponse.json({ error: "Invalid project in import." }, { status: 400 });
  if (projects.length === 0) return NextResponse.json({ sourceCount: 0, matchedCount: 0, localDataRetained: true }, { headers: { "Cache-Control": "no-store" } });
  const supabase = await createServerSupabaseClient();
  const { data: existing, error: readError } = await supabase.from("projects").select("id").eq("user_id", user.id).in("id", projects.map((project) => project.id));
  if (readError) return NextResponse.json({ error: "Import could not inspect destination projects.", code: "IMPORT_DESTINATION_READ_FAILED" }, { status: 500 });
  const existingIds = new Set((existing ?? []).map((row) => row.id));
  const additions = projects.filter((project) => !existingIds.has(project.id));
  if (additions.length > 0) {
    const { error: insertError } = await supabase.from("projects").insert(additions.map((project) => ({ user_id: user.id, id: project.id, data: project })));
    if (insertError) return NextResponse.json({ error: "Import could not create destination projects.", code: "IMPORT_INSERT_FAILED" }, { status: 500 });
  }
  for (const project of projects.filter((candidate) => existingIds.has(candidate.id))) {
    const { error: updateError } = await supabase.from("projects").update({ data: project }).eq("user_id", user.id).eq("id", project.id);
    if (updateError) return NextResponse.json({ error: "Import could not update destination projects.", code: "IMPORT_UPDATE_FAILED" }, { status: 500 });
  }
  const { count, error: countError } = await supabase.from("projects").select("id", { count: "exact", head: true }).eq("user_id", user.id).in("id", projects.map((p) => p.id));
  if (countError) return NextResponse.json({ error: "Import verification failed." }, { status: 500 });
  return NextResponse.json({ sourceCount: projects.length, matchedCount: count ?? 0, localDataRetained: true }, { headers: { "Cache-Control": "no-store" } });
}
