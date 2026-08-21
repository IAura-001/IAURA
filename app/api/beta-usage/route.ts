import { NextResponse } from "next/server";

import { getAuthenticatedUser, authenticationRequiredResponse } from "@/core/auth/session";
import { BETA_USAGE_EVENT_TYPES, type BetaUsageEventType } from "@/core/betaUsage/types";
import { createServerSupabaseClient } from "@/lib/supabase/server";

const MILESTONES = new Set([
  "beta-context", "beta-outcome", "beta-next-step", "beta-session-decision",
  "beta-execution-evaluation", "beta-session-evaluation", "beta-session-closure",
  "beta-post-closure-handoff", "beta-incomplete-execution-recovery",
]);

export async function POST(request: Request) {
  const user = await getAuthenticatedUser();
  if (!user) return authenticationRequiredResponse();

  const body = await request.json().catch(() => null) as Record<string, unknown> | null;
  const type = body?.type;
  if (typeof type !== "string" || !BETA_USAGE_EVENT_TYPES.includes(type as BetaUsageEventType)) {
    return NextResponse.json({ error: "Invalid beta usage event." }, { status: 400 });
  }

  const projectId = typeof body?.projectId === "string" && body.projectId.trim()
    ? body.projectId.trim().slice(0, 200) : null;
  const milestone = typeof body?.milestone === "string" && MILESTONES.has(body.milestone)
    ? body.milestone : null;
  if (["project_opened", "project_created", "beta_step_completed"].includes(type)
    && !projectId) {
    return NextResponse.json({ error: "Project scope required." }, { status: 400 });
  }

  const supabase = await createServerSupabaseClient();
  if (projectId) {
    const { data: project, error: projectError } = await supabase
      .from("projects").select("id").eq("user_id", user.id)
      .eq("id", projectId).maybeSingle();
    if (projectError || !project) {
      return NextResponse.json({ error: "Project scope not found." }, { status: 400 });
    }
  }
  const eventKey = type === "beta_signed_in"
    ? `beta_signed_in:${new Date().toISOString().slice(0, 10)}` : null;
  const { error } = await supabase.from("beta_usage_events").insert({
    user_id: user.id, event_type: type, project_id: projectId,
    event_key: eventKey, metadata: milestone ? { milestone } : {},
  });

  if (error?.code === "23505" && type === "beta_signed_in") {
    return NextResponse.json({ recorded: true, deduplicated: true }, { status: 202 });
  }

  if (error) {
    console.error("Beta usage event persistence failed:", {
      code: error.code ?? "unknown",
      message: error.message,
      details: error.details,
      hint: error.hint,
      userId: user.id,
      eventType: type,
      projectId,
    });
    return NextResponse.json({ recorded: false }, { status: 503 });
  }

  return NextResponse.json({ recorded: true }, { status: 202 });
}
