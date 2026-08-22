import { NextResponse } from "next/server";

import { authenticationRequiredResponse, getAuthenticatedUser } from "@/core/auth/session";
import { reorderIntelligencePriorities, requireCurrentIntelligenceScope } from "@/core/intelligence/server";
import type { IntelligenceScopeType } from "@/core/intelligence/domain";

const headers = { "Cache-Control": "no-store" };

export async function POST(request: Request) {
  const user = await getAuthenticatedUser();
  if (!user) return authenticationRequiredResponse();
  const body = await request.json().catch(() => null) as {
    scopeType?: IntelligenceScopeType;
    projectId?: string | null;
    orderedPriorityIds?: string[];
    expectedPriorities?: Array<{ recordId: string; position: number; updatedAt: string }>;
    expectedActiveProjectId?: string | null;
  } | null;
  if (!body || !Array.isArray(body.orderedPriorityIds)) {
    return NextResponse.json({ error: "IAURA_INTELLIGENCE_INVALID_PRIORITY_ORDER" }, { status: 400, headers });
  }
  try {
    await requireCurrentIntelligenceScope(user.id, body.scopeType as IntelligenceScopeType, body.projectId ?? null, body.expectedActiveProjectId ?? null);
    const records = await reorderIntelligencePriorities(
      user.id,
      body.scopeType as IntelligenceScopeType,
      body.projectId ?? null,
      body.orderedPriorityIds,
      body.expectedPriorities,
    );
    return NextResponse.json({ records }, { headers });
  } catch (error) {
    const code = error instanceof Error ? error.message : "IAURA_INTELLIGENCE_FAILED";
    const invalid = code.startsWith("IAURA_INTELLIGENCE_INVALID_") || code === "IAURA_INTELLIGENCE_PROJECT_NOT_OWNED";
    const stale = code === "IAURA_INTELLIGENCE_STALE";
    return NextResponse.json(
      { error: invalid || stale ? code : "Unable to reorder priorities." },
      { status: stale ? 409 : invalid ? 400 : 500, headers },
    );
  }
}
