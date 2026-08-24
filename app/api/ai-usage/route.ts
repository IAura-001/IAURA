import { NextResponse } from "next/server";
import { authenticationRequiredResponse, getAuthenticatedUser } from "@/core/auth/session";
import { FounderAiCostAccessError, getFounderAiCostOperations } from "@/core/aiUsage/founderServer";
export async function GET() {
  if (!(await getAuthenticatedUser())) return authenticationRequiredResponse();
  try { return NextResponse.json(await getFounderAiCostOperations(), { headers: { "Cache-Control": "no-store" } }); }
  catch (error) {
    if (error instanceof FounderAiCostAccessError) return NextResponse.json({ error: "Founder access required." }, { status: 403 });
    return NextResponse.json({ error: "AI cost operations unavailable." }, { status: 503 });
  }
}
