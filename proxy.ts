import {
  NextResponse,
  type NextRequest,
} from "next/server";

import {
  hasValidAccessConfiguration,
  isRequestAuthorized,
} from "@/core/auth/access";

export function proxy(request: NextRequest) {
  if (
    request.nextUrl.pathname === "/api/access"
  ) {
    return NextResponse.next();
  }

  if (
    request.nextUrl.pathname.startsWith("/api/creative/") &&
    !hasValidAccessConfiguration()
  ) {
    return NextResponse.json(
      {
        error: "IAURA private access is not configured.",
        code: "IAURA_ACCESS_NOT_CONFIGURED",
      },
      {
        status: 503,
        headers: {
          "Cache-Control": "no-store",
        },
      }
    );
  }

  if (isRequestAuthorized(request)) {
    return NextResponse.next();
  }

  if (
    request.nextUrl.pathname.startsWith(
      "/api/"
    )
  ) {
    return NextResponse.json(
      {
        error: "IAURA private access required.",
        code: "IAURA_ACCESS_REQUIRED",
      },
      {
        status: 401,
        headers: {
          "Cache-Control": "no-store",
        },
      }
    );
  }

  const accessUrl = new URL("/access", request.url);
  accessUrl.searchParams.set(
    "next",
    `${request.nextUrl.pathname}${request.nextUrl.search}`,
  );

  return NextResponse.redirect(accessUrl);
}

export const config = {
  matcher: [
    "/iaura/:path*",
    "/api/:path*",
  ],
};
