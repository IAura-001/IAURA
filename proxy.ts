import {
  NextResponse,
  type NextRequest,
} from "next/server";

import { isRequestAuthorized } from "@/core/auth/access";

export function proxy(request: NextRequest) {
  if (
    request.nextUrl.pathname === "/api/access"
  ) {
    return NextResponse.next();
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

  return NextResponse.redirect(
    new URL("/access", request.url)
  );
}

export const config = {
  matcher: [
    "/iaura/:path*",
    "/api/:path*",
  ],
};
