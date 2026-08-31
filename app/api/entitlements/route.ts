import { NextResponse } from "next/server";
import { authenticationRequiredResponse, getAuthenticatedUser } from "@/core/auth/session";
import { EntitlementSystemError, getEffectiveEntitlements, safeEntitlementView } from "@/core/entitlements/server";

export async function GET(request: Request) {
  if (!(await getAuthenticatedUser(request))) return authenticationRequiredResponse();
  try { return NextResponse.json(safeEntitlementView(await getEffectiveEntitlements(request)),
    { headers: { "Cache-Control": "no-store" } }); }
  catch (error) { if (error instanceof EntitlementSystemError) return NextResponse.json(
    { error: "Entitlements are temporarily unavailable." }, { status: 503, headers: { "Cache-Control": "no-store" } }); throw error; }
}
