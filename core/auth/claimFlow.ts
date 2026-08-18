import { NextResponse } from "next/server";

import {
  ACCESS_COOKIE_NAME,
  ACCESS_SESSION_SECONDS,
  createAccessToken,
  getAccessSecret,
  hasValidAccessConfiguration,
} from "./access";
import {
  clearClaimContextCookie,
  hasClaimContextCookie,
  readClaimContext,
} from "./claimContext";
import {
  claimCurrentUserBetaInvite,
  getCurrentBetaMembership,
} from "./membership";

export async function completePostAuthClaim(
  request: Request,
  nextPath: string,
) {
  const inviteToken = readClaimContext(request);
  const membership = await getCurrentBetaMembership();

  if (!inviteToken) {
    if (membership?.status === "active") {
      const response = accessRedirect(request, nextPath);

      if (hasClaimContextCookie(request)) {
        clearClaimContextCookie(response);
      }

      return response;
    }

    const accessUrl = new URL("/access", request.url);
    accessUrl.searchParams.set("next", nextPath);

    const response = NextResponse.redirect(accessUrl, 303);

    if (hasClaimContextCookie(request)) {
      clearClaimContextCookie(response);
    }

    return response;
  }

  if (membership?.status === "active") {
    const response = accessRedirect(request, "/iaura");
    clearClaimContextCookie(response);
    return response;
  }

  try {
    await claimCurrentUserBetaInvite(inviteToken);

    const response = accessRedirect(request, "/iaura");
    clearClaimContextCookie(response);
    return response;
  } catch {
    const response = NextResponse.redirect(
      new URL("/iaura?invite=unavailable", request.url),
      303,
    );

    clearClaimContextCookie(response);
    return response;
  }
}

function accessRedirect(
  request: Request,
  destination: string,
) {
  const secret = getAccessSecret();

  if (!hasValidAccessConfiguration(secret)) {
    const accessUrl = new URL("/access", request.url);
    accessUrl.searchParams.set("next", destination);

    return NextResponse.redirect(accessUrl, 303);
  }

  const response = new NextResponse(null, {
  status: 303,
  headers: {
    Location: destination,
  },
});

  response.cookies.set({
    name: ACCESS_COOKIE_NAME,
    value: createAccessToken(secret),
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: ACCESS_SESSION_SECONDS,
    priority: "high",
  });

  response.headers.set("Cache-Control", "no-store");

  return response;
}