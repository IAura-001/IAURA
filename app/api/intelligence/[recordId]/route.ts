import { NextResponse } from "next/server";

import { authenticationRequiredResponse, getAuthenticatedUser } from "@/core/auth/session";
import { archiveIntelligenceRecord, updateIntelligenceRecord } from "@/core/intelligence/server";
import type { IntelligenceUpdateInput } from "@/core/intelligence/domain";

const headers = { "Cache-Control": "no-store" };

function failure(error: unknown): NextResponse {
  const code = error instanceof Error ? error.message : "IAURA_INTELLIGENCE_FAILED";
  const notFound = code === "IAURA_INTELLIGENCE_NOT_FOUND";
  const invalid = code.startsWith("IAURA_INTELLIGENCE_INVALID_");
  return NextResponse.json(
    { error: notFound || invalid ? code : "Unable to update intelligence record." },
    { status: notFound ? 404 : invalid ? 400 : 500, headers },
  );
}

type RecordRouteContext = { params: Promise<{ recordId: string }> };

async function recordId(context: RecordRouteContext): Promise<string> {
  const value = (await context.params).recordId.trim();
  if (!value || value.length > 200) throw new Error("IAURA_INTELLIGENCE_INVALID_ID");
  return value;
}

export async function PATCH(
  request: Request,
  context: RecordRouteContext,
) {
  const user = await getAuthenticatedUser();
  if (!user) return authenticationRequiredResponse();
  const body = await request.json().catch(() => null) as { updates?: IntelligenceUpdateInput } | null;
  if (!body?.updates || typeof body.updates !== "object") return failure(new Error("IAURA_INTELLIGENCE_INVALID_INPUT"));
  try {
    const record = await updateIntelligenceRecord(user.id, await recordId(context), body.updates);
    return NextResponse.json({ record }, { headers });
  } catch (error) {
    return failure(error);
  }
}

export async function DELETE(
  _request: Request,
  context: RecordRouteContext,
) {
  const user = await getAuthenticatedUser();
  if (!user) return authenticationRequiredResponse();
  try {
    const record = await archiveIntelligenceRecord(user.id, await recordId(context));
    return NextResponse.json({ record }, { headers });
  } catch (error) {
    return failure(error);
  }
}
