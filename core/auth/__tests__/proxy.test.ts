import { NextRequest, NextResponse } from "next/server";
import {
  getRedirectUrl,
  unstable_doesMiddlewareMatch,
} from "next/experimental/testing/server";
import {
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from "vitest";

import { config, proxy } from "@/proxy";

const authMock = vi.hoisted(() => ({
  hasValidAccessConfiguration: vi.fn(),
  isRequestAuthorized: vi.fn(),
}));
const sessionMock = vi.hoisted(() => ({
  user: null as { id: string } | null,
  refresh: vi.fn(),
}));

vi.mock("@/core/auth/access", () => ({
  hasValidAccessConfiguration:
    authMock.hasValidAccessConfiguration,
  isRequestAuthorized:
    authMock.isRequestAuthorized,
}));
vi.mock("@/lib/supabase/proxy", async () => {
  return {
    refreshSupabaseSession: sessionMock.refresh,
    copyResponseCookies: (_source: Response, target: Response) => target,
  };
});

describe("VAEORA and IAURA route boundaries", () => {
  const matches = (pathname: string) =>
    unstable_doesMiddlewareMatch({
      config,
      nextConfig: {},
      url: `https://vaeora.test${pathname}`,
    });

  it.each([
    "/",
    "/access",
    "/icon.svg",
  ])("keeps the public experience outside Proxy: %s", (url) => {
    expect(matches(url)).toBe(false);
  });

  it.each([
    "/iaura",
    "/iaura/workspace",
    "/api/chat",
    "/api/transcribe",
    "/api/voice",
    "/api/access",
    "/api/status",
  ])("runs Proxy for protected intelligence: %s", (url) => {
    expect(matches(url)).toBe(true);
  });
});

describe("IAURA authorization behavior", () => {
  beforeEach(() => {
    authMock.hasValidAccessConfiguration.mockReset();
    authMock.isRequestAuthorized.mockReset();
    authMock.hasValidAccessConfiguration.mockReturnValue(true);
    sessionMock.user = { id: "10000000-0000-0000-0000-000000000001" };
    sessionMock.refresh.mockReset();
    sessionMock.refresh.mockImplementation(async (request: NextRequest) => ({
      response: NextResponse.next({ request }),
      user: sessionMock.user,
    }));
  });

  it("allows the public access endpoint to establish a session", async () => {
    authMock.isRequestAuthorized.mockReturnValue(false);

    const response = await proxy(
      new NextRequest("https://vaeora.test/api/access")
    );

    expect(response.status).toBe(200);
    expect(
      response.headers.get("x-middleware-next")
    ).toBe("1");
    expect(
      authMock.isRequestAuthorized
    ).not.toHaveBeenCalled();
  });

  it("redirects an unauthorized IAURA request", async () => {
    authMock.isRequestAuthorized.mockReturnValue(false);

    const response = await proxy(
      new NextRequest("https://vaeora.test/iaura")
    );

    expect(response.status).toBe(307);
    expect(getRedirectUrl(response)).toBe(
      "https://vaeora.test/access?next=%2Fiaura"
    );
  });

  it("preserves a validated IAURA deep link through private access", async () => {
    authMock.isRequestAuthorized.mockReturnValue(false);

    const response = await proxy(
      new NextRequest(
        "https://vaeora.test/iaura?view=projects&intent=branding",
      ),
    );

    expect(getRedirectUrl(response)).toBe(
      "https://vaeora.test/access?next=%2Fiaura%3Fview%3Dprojects%26intent%3Dbranding",
    );
  });

  it.each([
    "/api/chat",
    "/api/voice",
    "/api/transcribe",
    "/api/creative/copy",
    "/api/creative/image",
  ])("returns JSON 401 for unauthorized %s", async (path) => {
    authMock.isRequestAuthorized.mockReturnValue(false);

    const response = await proxy(
      new NextRequest(`https://vaeora.test${path}`)
    );

    expect(response.status).toBe(401);
    expect(
      response.headers.get("cache-control")
    ).toBe("no-store");
    await expect(response.json()).resolves.toEqual({
      error: "IAURA private access required.",
      code: "IAURA_ACCESS_REQUIRED",
    });
  });

  it("returns 503 for creative APIs when access is not configured", async () => {
    authMock.hasValidAccessConfiguration.mockReturnValue(false);

    const response = await proxy(
      new NextRequest("https://vaeora.test/api/creative/image")
    );

    expect(response.status).toBe(503);
    expect(
      response.headers.get("cache-control")
    ).toBe("no-store");
    await expect(response.json()).resolves.toEqual({
      error: "IAURA private access is not configured.",
      code: "IAURA_ACCESS_NOT_CONFIGURED",
    });
    expect(
      authMock.isRequestAuthorized
    ).not.toHaveBeenCalled();
  });

  it("allows an authorized protected request", async () => {
    authMock.isRequestAuthorized.mockReturnValue(true);

    const response = await proxy(
      new NextRequest("https://vaeora.test/iaura")
    );

    expect(response.status).toBe(200);
    expect(
      response.headers.get("x-middleware-next")
    ).toBe("1");
  });

  it("does not inspect Supabase before the outer gate passes", async () => {
    authMock.isRequestAuthorized.mockReturnValue(false);
    await proxy(new NextRequest("https://vaeora.test/iaura"));
    expect(sessionMock.refresh).not.toHaveBeenCalled();
  });

  it("sends an outer-authorized visitor without a user to login", async () => {
    authMock.isRequestAuthorized.mockReturnValue(true);
    sessionMock.user = null;
    const response = await proxy(new NextRequest("https://vaeora.test/iaura?view=projects"));
    expect(getRedirectUrl(response)).toBe(
      "https://vaeora.test/login?next=%2Fiaura%3Fview%3Dprojects",
    );
  });

  it("returns IAURA_AUTH_REQUIRED for an outer-authorized API without a user", async () => {
    authMock.isRequestAuthorized.mockReturnValue(true);
    sessionMock.user = null;
    const response = await proxy(new NextRequest("https://vaeora.test/api/chat"));
    expect(response.status).toBe(401);
    await expect(response.json()).resolves.toMatchObject({ code: "IAURA_AUTH_REQUIRED" });
  });

  it("rejects an unsafe next destination for an authenticated login request", async () => {
    authMock.isRequestAuthorized.mockReturnValue(true);
    const response = await proxy(new NextRequest("https://vaeora.test/login?next=https://evil.test"));
    expect(getRedirectUrl(response)).toBe("https://vaeora.test/iaura");
  });
});
