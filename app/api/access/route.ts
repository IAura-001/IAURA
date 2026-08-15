import { NextResponse } from "next/server";

import {
  ACCESS_COOKIE_NAME,
  ACCESS_SESSION_SECONDS,
  createAccessToken,
  getAccessSecret,
  hasValidAccessConfiguration,
  matchesAccessKey,
} from "@/core/auth/access";
import {
  clearAccessFailures,
  getAccessAttemptStatus,
  recordAccessFailure,
} from "@/core/auth/accessAttempts";
import {
  clearClaimContextCookie,
  createClaimContext,
  setClaimContextCookie,
} from "@/core/auth/claimContext";
import {
  claimCurrentUserBetaInvite,
  getCurrentBetaMembership,
  recognizeBetaInvite,
} from "@/core/auth/membership";
import { getAuthenticatedUser } from "@/core/auth/session";

interface AccessRequestBody {
  accessKey?: unknown;
}

function tooManyAttemptsResponse(retryAfter?: number) {
  return NextResponse.json(
    {
      error: "Too many access attempts. Try again later.",
    },
    {
      status: 429,
      headers: {
        "Cache-Control": "no-store",
        "Retry-After": String(retryAfter ?? 1),
      },
    }
  );
}

export async function POST(
  request: Request
) {
  const secret = getAccessSecret();

  if (!hasValidAccessConfiguration(secret)) {
    return NextResponse.json(
      {
        error:
          "IAURA private access is not configured.",
      },
      {
        status: 503,
        headers: {
          "Cache-Control": "no-store",
        },
      }
    );
  }

  let body: AccessRequestBody;

  try {
    body =
      (await request.json()) as AccessRequestBody;
  } catch {
    const attemptStatus = getAccessAttemptStatus(request);

    if (!attemptStatus.allowed) {
      return tooManyAttemptsResponse(attemptStatus.retryAfter);
    }

    recordAccessFailure(request);
    return NextResponse.json(
      {
        error: "Invalid access request.",
      },
      {
        status: 400,
        headers: {
          "Cache-Control": "no-store",
        },
      }
    );
  }

  const accessKey =
    typeof body.accessKey === "string"
      ? body.accessKey.trim()
      : "";

  if (
    accessKey &&
    matchesAccessKey(accessKey, secret)
  ) {
    clearAccessFailures(request);

    const response = accessGranted(secret);
    clearClaimContextCookie(response);
    return response;
  }

  if (accessKey && await recognizeBetaInvite(accessKey)) {
    const user = await getAuthenticatedUser();

    if (user) {
      const membership = await getCurrentBetaMembership();
      if (!membership || membership.status !== "active") {
        try {
          await claimCurrentUserBetaInvite(accessKey);
        } catch {
          return unrecognized(request);
        }
      }

      clearAccessFailures(request);
      const response = accessGranted(secret, "/iaura");
      clearClaimContextCookie(response);
      return response;
    }

    let context: string;
    try {
      context = createClaimContext(accessKey);
    } catch {
      return NextResponse.json(
        { error: "IAURA private access is not configured." },
        { status: 503, headers: { "Cache-Control": "no-store" } },
      );
    }

    clearAccessFailures(request);
    const response = accessGranted(secret, "/signup");
    setClaimContextCookie(response, context);
    return response;
  }

  return unrecognized(request);
}

function accessGranted(secret: string, next?: string) {
  const response = NextResponse.json({ authenticated: true, ...(next ? { next } : {}) });
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

function unrecognized(request: Request) {
  const attemptStatus = getAccessAttemptStatus(request);

  if (!attemptStatus.allowed) {
    return tooManyAttemptsResponse(attemptStatus.retryAfter);
  }

  recordAccessFailure(request);
  return NextResponse.json(
    {
      error: "Invalid access key.",
    },
    {
      status: 401,
      headers: {
        "Cache-Control": "no-store",
      },
    }
  );
}
