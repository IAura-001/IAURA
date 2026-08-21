import { NextResponse } from "next/server";

import { authenticationRequiredResponse, getAuthenticatedUser } from "@/core/auth/session";
import { reorderIntelligencePriorities } from "@/core/intelligence/server";
import type { IntelligenceScopeType } from "@/core/intelligence/domain";

const headers = { "Cache-Control": "no-store" };

export async function POST(request: Request) {
  const user = await getAuthenticatedUser();
  if (!user) return authenticationRequiredResponse();
  const body = await request.json().catch(() => null) as {
    scopeType?: IntelligenceScopeType;
    projectId?: string | null;
    orderedPriorityIds?: string[];
  } | null;
  if (!body || !Array.isArray(body.orderedPriorityIds)) {
    return NextResponse.json({ error: "IAURA_INTELLIGENCE_INVALID_PRIORITY_ORDER" }, { status: 400, headers });
  }
  try {
    const records = await reorderIntelligencePriorities(
      user.id,
      body.scopeType as IntelligenceScopeType,
      body.projectId ?? null,
      body.orderedPriorityIds,
    );
    return NextResponse.json({ records }, { headers });
  } catch (error) {
    const code = error instanceof Error ? error.message : "IAURA_INTELLIGENCE_FAILED";
    const invalid = code.startsWith("IAURA_INTELLIGENCE_INVALID_") || code === "IAURA_INTELLIGENCE_PROJECT_NOT_OWNED";
    return NextResponse.json(
      { error: invalid ? code : "Unable to reorder priorities." },
      { status: invalid ? 400 : 500, headers },
    );
  }
}
