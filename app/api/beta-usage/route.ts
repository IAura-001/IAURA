import { NextResponse } from "next/server";

import { getAuthenticatedUser, authenticationRequiredResponse } from "@/core/auth/session";
import { BETA_USAGE_EVENT_TYPES, type BetaUsageEventType } from "@/core/betaUsage/types";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { FounderUsageAccessError, getFounderBetaUsage } from "@/core/betaUsage/server";
import { normalizeProductFunnelEvent } from "@/core/betaUsage/funnel";
import { recordProductEvent } from "@/core/betaUsage/record";

const MILESTONES = new Set([
  "beta-context", "beta-outcome", "beta-next-step", "beta-session-decision",
  "beta-execution-evaluation", "beta-session-evaluation", "beta-session-closure",
  "beta-post-closure-handoff", "beta-incomplete-execution-recovery",
]);

export async function GET() {
  const user = await getAuthenticatedUser();
  if (!user) return authenticationRequiredResponse();
  try {
    return NextResponse.json(await getFounderBetaUsage(), {
      headers: { "Cache-Control": "no-store" },
    });
  } catch (error) {
    if (error instanceof FounderUsageAccessError) {
      return NextResponse.json({ error: "Founder access required." }, {
        status: 403, headers: { "Cache-Control": "no-store" },
      });
    }
    return NextResponse.json({ error: "Beta operations data is unavailable." }, {
      status: 503, headers: { "Cache-Control": "no-store" },
    });
  }
}

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
  if (["project_opened", "project_created", "beta_step_completed", "project_scoped_result", "durable_output"].includes(type)
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
  const normalized = normalizeProductFunnelEvent({ ...body, schemaVersion: body?.schemaVersion ?? 1 });
  if (!normalized) return NextResponse.json({ error: "Invalid event schema." }, { status: 400 });
  const eventKey = normalized.eventKey ?? (type === "beta_signed_in"
    ? `beta_signed_in:${new Date().toISOString().slice(0, 10)}` : null);
  const recorded = await recordProductEvent(supabase, {
    type, projectId, eventKey, sessionId: normalized.sessionId,
    source: normalized.source,
    metadata: { ...normalized.metadata, ...(milestone ? { milestone } : {}) },
  });
  if (!recorded) {
    return NextResponse.json({ recorded: false }, { status: 503 });
  }

  return NextResponse.json({ recorded: true }, { status: 202 });
}
