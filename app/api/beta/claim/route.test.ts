import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  isRequestAuthorized: vi.fn(),
  getAuthenticatedUser: vi.fn(),
  claim: vi.fn(),
}));

vi.mock("@/core/auth/access", () => ({ isRequestAuthorized: mocks.isRequestAuthorized }));
vi.mock("@/core/auth/session", async () => {
  const { NextResponse } = await import("next/server");
  return {
    getAuthenticatedUser: mocks.getAuthenticatedUser,
    authenticationRequiredResponse: () => NextResponse.json(
      { error: "IAURA authentication required.", code: "IAURA_AUTH_REQUIRED" },
      { status: 401, headers: { "Cache-Control": "no-store" } },
    ),
  };
});
vi.mock("@/core/auth/membership", () => {
  class BetaClaimError extends Error {
    constructor(public readonly kind: string) { super(kind); }
  }
  return { BetaClaimError, claimCurrentUserBetaInvite: mocks.claim };
});

import { BetaClaimError } from "@/core/auth/membership";
import { POST } from "./route";

function claimRequest(body: unknown, cookie = "iaura_beta_access=outer") {
  return new Request("https://vaeora.test/api/beta/claim", {
    method: "POST",
    headers: { "Content-Type": "application/json", Cookie: cookie },
    body: typeof body === "string" ? body : JSON.stringify(body),
  });
}

describe("POST /api/beta/claim", () => {
  beforeEach(() => {
    mocks.isRequestAuthorized.mockReset().mockReturnValue(true);
    mocks.getAuthenticatedUser.mockReset().mockResolvedValue({ id: "user-a" });
    mocks.claim.mockReset().mockResolvedValue({ role: "member", status: "active", claimedAt: "2026-08-15T20:00:00Z" });
  });

  it("returns only safe membership fields after a successful claim", async () => {
    const response = await POST(claimRequest({ inviteToken: "a".repeat(32) }));
    expect(response.status).toBe(201);
    await expect(response.json()).resolves.toEqual({ membership: {
      active: true, role: "member", status: "active", claimedAt: "2026-08-15T20:00:00Z",
    } });
    expect(response.headers.get("cache-control")).toBe("no-store");
  });

  it("enforces the outer gate before checking personal identity", async () => {
    mocks.isRequestAuthorized.mockReturnValue(false);
    const response = await POST(claimRequest({ inviteToken: "a".repeat(32) }, ""));
    expect(response.status).toBe(401);
    expect(mocks.getAuthenticatedUser).not.toHaveBeenCalled();
    expect(mocks.claim).not.toHaveBeenCalled();
  });

  it("requires a verified Supabase user before parsing or claiming", async () => {
    mocks.getAuthenticatedUser.mockResolvedValue(null);
    const response = await POST(claimRequest("{invalid"));
    expect(response.status).toBe(401);
    await expect(response.json()).resolves.toMatchObject({ code: "IAURA_AUTH_REQUIRED" });
    expect(mocks.claim).not.toHaveBeenCalled();
  });

  it.each([null, {}, { inviteToken: "short" }, { inviteToken: "a".repeat(32), role: "founder" }, { inviteToken: "a".repeat(32), userId: "other" }])(
    "rejects malformed or authority-bearing input %#", async (body) => {
      const response = await POST(claimRequest(body));
      expect(response.status).toBe(400);
      expect(mocks.claim).not.toHaveBeenCalled();
    },
  );

  it("collapses unavailable invite reasons", async () => {
    mocks.claim.mockRejectedValue(new BetaClaimError("unavailable"));
    const response = await POST(claimRequest({ inviteToken: "a".repeat(32) }));
    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toMatchObject({ code: "IAURA_INVITE_UNAVAILABLE" });
  });

  it("returns a stable replay/already-member result", async () => {
    mocks.claim.mockRejectedValue(new BetaClaimError("already_member"));
    const response = await POST(claimRequest({ inviteToken: "a".repeat(32) }));
    expect(response.status).toBe(409);
    await expect(response.json()).resolves.toMatchObject({ code: "IAURA_ALREADY_MEMBER" });
  });
});
