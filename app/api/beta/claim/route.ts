import { NextResponse } from "next/server";

import { isRequestAuthorized } from "@/core/auth/access";
import {
  BetaClaimError,
  claimCurrentUserBetaInvite,
} from "@/core/auth/membership";
import {
  authenticationRequiredResponse,
  getAuthenticatedUser,
} from "@/core/auth/session";

const NO_STORE = { "Cache-Control": "no-store" };

export async function POST(request: Request) {
  if (!isRequestAuthorized(request)) {
    return NextResponse.json(
      { error: "IAURA private access required.", code: "IAURA_ACCESS_REQUIRED" },
      { status: 401, headers: NO_STORE },
    );
  }

  if (!(await getAuthenticatedUser())) return authenticationRequiredResponse();

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return malformedToken();
  }

  if (!isClaimBody(body)) return malformedToken();

  try {
    const membership = await claimCurrentUserBetaInvite(body.inviteToken);
    return NextResponse.json(
      { membership: { active: membership.status === "active", ...membership } },
      { status: 201, headers: NO_STORE },
    );
  } catch (error) {
    if (error instanceof BetaClaimError && error.kind === "unauthenticated") {
      return authenticationRequiredResponse();
    }
    if (error instanceof BetaClaimError && error.kind === "already_member") {
      return NextResponse.json(
        { error: "This account already has Beta access.", code: "IAURA_ALREADY_MEMBER" },
        { status: 409, headers: NO_STORE },
      );
    }
    return NextResponse.json(
      { error: "This invitation is unavailable.", code: "IAURA_INVITE_UNAVAILABLE" },
      { status: 400, headers: NO_STORE },
    );
  }
}

function isClaimBody(body: unknown): body is { inviteToken: string } {
  if (!body || typeof body !== "object" || Array.isArray(body)) return false;
  const record = body as Record<string, unknown>;
  return (
    Object.keys(record).length === 1 &&
    typeof record.inviteToken === "string" &&
    record.inviteToken.length >= 32 &&
    record.inviteToken.length <= 512
  );
}

function malformedToken() {
  return NextResponse.json(
    { error: "A valid invitation token is required.", code: "IAURA_INVITE_TOKEN_INVALID" },
    { status: 400, headers: NO_STORE },
  );
}
