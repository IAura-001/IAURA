import {
  NextResponse,
  type NextRequest,
} from "next/server";

import {
  hasValidAccessConfiguration,
  isRequestAuthorized,
} from "@/core/auth/access";
import { AUTH_REQUIRED_CODE, safeIauraNextPath } from "@/core/auth/redirects";
import {
  copyResponseCookies,
  refreshSupabaseSession,
} from "@/lib/supabase/proxy";

const AUTH_PAGES = new Set(["/login", "/signup"]);
const AUTH_ENTRY_APIS = new Set(["/api/auth/login", "/api/auth/signup"]);

export async function proxy(request: NextRequest) {
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
    const session = await refreshSupabaseSession(request);
    const pathname = request.nextUrl.pathname;
    const isAuthEntry = AUTH_PAGES.has(pathname) || AUTH_ENTRY_APIS.has(pathname);

    if (isAuthEntry) {
      if (!session.user) return session.response;
      const destination = new URL(
        safeIauraNextPath(request.nextUrl.searchParams.get("next")),
        request.url,
      );
      return copyResponseCookies(session.response, NextResponse.redirect(destination));
    }

    if (session.user) return session.response;

    if (pathname.startsWith("/api/")) {
      const authRequired = NextResponse.json(
        {
          error: "IAURA authentication required.",
          code: AUTH_REQUIRED_CODE,
        },
        { status: 401, headers: { "Cache-Control": "no-store" } },
      );
      return copyResponseCookies(session.response, authRequired);
    }

    const loginUrl = new URL("/login", request.url);
    loginUrl.searchParams.set(
      "next",
      safeIauraNextPath(`${pathname}${request.nextUrl.search}`),
    );
    return copyResponseCookies(session.response, NextResponse.redirect(loginUrl));
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
    "/login",
    "/signup",
    "/api/:path*",
  ],
};
