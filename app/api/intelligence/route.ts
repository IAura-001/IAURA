import { NextResponse, type NextRequest } from "next/server";

import { authenticationRequiredResponse, getAuthenticatedUser } from "@/core/auth/session";
import {
  createIntelligenceRecord,
  listIntelligenceRecords,
  loadIntelligenceProjection,
} from "@/core/intelligence/server";
import type { IntelligenceCreateInput } from "@/core/intelligence/domain";

const headers = { "Cache-Control": "no-store" };

function failure(error: unknown): NextResponse {
  const code = error instanceof Error ? error.message : "IAURA_INTELLIGENCE_FAILED";
  const clientError = code.startsWith("IAURA_INTELLIGENCE_INVALID_") ||
    code === "IAURA_INTELLIGENCE_PROJECT_NOT_OWNED" ||
    code === "IAURA_INTELLIGENCE_PRIORITY_LIMIT";
  return NextResponse.json(
    { error: clientError ? code : "Unable to process intelligence records." },
    { status: clientError ? 400 : 500, headers },
  );
}

export async function GET(request: NextRequest) {
  const user = await getAuthenticatedUser();
  if (!user) return authenticationRequiredResponse();
  const hasProjectionQuery = request.nextUrl.searchParams.has("projectId") ||
    request.nextUrl.searchParams.get("scope") === "global";
  const projectId = request.nextUrl.searchParams.get("projectId")?.trim() || null;
  try {
    const records = hasProjectionQuery
      ? await loadIntelligenceProjection(user.id, projectId)
      : await listIntelligenceRecords(user.id);
    return NextResponse.json({ records }, { headers });
  } catch (error) {
    return failure(error);
  }
}

export async function POST(request: Request) {
  const user = await getAuthenticatedUser();
  if (!user) return authenticationRequiredResponse();
  const body = await request.json().catch(() => null) as { record?: IntelligenceCreateInput } | null;
  if (!body?.record || typeof body.record !== "object") return failure(new Error("IAURA_INTELLIGENCE_INVALID_INPUT"));
  try {
    const record = await createIntelligenceRecord(user.id, body.record);
    return NextResponse.json({ record }, { status: 201, headers });
  } catch (error) {
    return failure(error);
  }
}
