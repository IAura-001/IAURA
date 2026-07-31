import {
  NextResponse,
  type NextRequest,
} from "next/server";

import { isRequestAuthorized } from "@/core/auth/access";

export function proxy(request: NextRequest) {
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
    "/((?!access|api/access|_next/static|_next/image|favicon.ico|icon.svg|.*\\..*).*)",
  ],
};
