import { NextRequest } from "next/server";
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
  isRequestAuthorized: vi.fn(),
}));

vi.mock("@/core/auth/access", () => ({
  isRequestAuthorized:
    authMock.isRequestAuthorized,
}));

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
    authMock.isRequestAuthorized.mockReset();
  });

  it("allows the public access endpoint to establish a session", () => {
    authMock.isRequestAuthorized.mockReturnValue(false);

    const response = proxy(
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

  it("redirects an unauthorized IAURA request", () => {
    authMock.isRequestAuthorized.mockReturnValue(false);

    const response = proxy(
      new NextRequest("https://vaeora.test/iaura")
    );

    expect(response.status).toBe(307);
    expect(getRedirectUrl(response)).toBe(
      "https://vaeora.test/access"
    );
  });

  it.each([
    "/api/chat",
    "/api/voice",
    "/api/transcribe",
  ])("returns JSON 401 for unauthorized %s", async (path) => {
    authMock.isRequestAuthorized.mockReturnValue(false);

    const response = proxy(
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

  it("allows an authorized protected request", () => {
    authMock.isRequestAuthorized.mockReturnValue(true);

    const response = proxy(
      new NextRequest("https://vaeora.test/iaura")
    );

    expect(response.status).toBe(200);
    expect(
      response.headers.get("x-middleware-next")
    ).toBe("1");
  });
});
