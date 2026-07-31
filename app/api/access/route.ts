import { NextResponse } from "next/server";

import {
  ACCESS_COOKIE_NAME,
  ACCESS_SESSION_SECONDS,
  createAccessToken,
  getAccessSecret,
  hasValidAccessConfiguration,
  matchesAccessKey,
} from "@/core/auth/access";

interface AccessRequestBody {
  accessKey?: unknown;
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
    return NextResponse.json(
      {
        error: "Invalid access request.",
      },
      {
        status: 400,
      }
    );
  }

  const accessKey =
    typeof body.accessKey === "string"
      ? body.accessKey.trim()
      : "";

  if (
    !accessKey ||
    !matchesAccessKey(accessKey, secret)
  ) {
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

  const response = NextResponse.json({
    authenticated: true,
  });

  response.cookies.set({
    name: ACCESS_COOKIE_NAME,
    value: createAccessToken(secret),
    httpOnly: true,
    secure:
      process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: ACCESS_SESSION_SECONDS,
    priority: "high",
  });
  response.headers.set(
    "Cache-Control",
    "no-store"
  );

  return response;
}
