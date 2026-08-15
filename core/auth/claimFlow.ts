import { NextResponse } from "next/server";

import {
  clearClaimContextCookie,
  hasClaimContextCookie,
  readClaimContext,
} from "./claimContext";
import { claimCurrentUserBetaInvite, getCurrentBetaMembership } from "./membership";

export async function completePostAuthClaim(request: Request, nextPath: string) {
  const inviteToken = readClaimContext(request);
  if (!inviteToken) {
    const response = NextResponse.redirect(new URL(nextPath, request.url), 303);
    if (hasClaimContextCookie(request)) clearClaimContextCookie(response);
    return response;
  }

  const membership = await getCurrentBetaMembership();
  if (membership?.status === "active") {
    const response = NextResponse.redirect(new URL("/iaura", request.url), 303);
    clearClaimContextCookie(response);
    return response;
  }

  try {
    await claimCurrentUserBetaInvite(inviteToken);
    const response = NextResponse.redirect(new URL("/iaura", request.url), 303);
    clearClaimContextCookie(response);
    return response;
  } catch {
    const response = NextResponse.redirect(new URL("/iaura?invite=unavailable", request.url), 303);
    clearClaimContextCookie(response);
    return response;
  }
}
