import { beforeEach, describe, expect, it, vi } from "vitest";
const mocks = vi.hoisted(() => ({ user: vi.fn(), effective: vi.fn() }));
vi.mock("@/core/auth/session", async () => { const { NextResponse } = await import("next/server"); return {
  getAuthenticatedUser: mocks.user,
  authenticationRequiredResponse: () => NextResponse.json({ code: "IAURA_AUTH_REQUIRED" }, { status: 401 }),
}; });
vi.mock("@/core/entitlements/server", async () => {
  const actual = await vi.importActual<typeof import("@/core/entitlements/server")>("@/core/entitlements/server");
  return { ...actual, getEffectiveEntitlements: mocks.effective };
});
import { GET } from "./route";

describe("GET /api/entitlements", () => {
  beforeEach(() => { mocks.user.mockReset().mockResolvedValue({ id: "user-a" }); mocks.effective.mockReset().mockResolvedValue({
    profileId: "beta_default_v1", capabilities: ["project.create"], limits: { maxActiveProjects: 100 },
    usage: { activeProjects: 1 }, period: { kind: "calendar_month", startsAt: "a", resetsAt: "b" },
    assignment: { startsAt: null, endsAt: null }, internalReason: "never expose",
  }); });
  it("requires server authentication and never accepts a client-selected profile", async () => {
    mocks.user.mockResolvedValueOnce(null);
    expect((await GET(new Request("https://vaeora.test/api/entitlements?profileId=internal_unrestricted_v1"))).status).toBe(401);
    expect(mocks.effective).not.toHaveBeenCalled();
  });
  it("returns only the authenticated user's safe effective read model", async () => {
    const response = await GET(new Request("https://vaeora.test/api/entitlements?userId=someone-else"));
    expect(response.status).toBe(200); const body = await response.json();
    expect(body.profileId).toBe("beta_default_v1"); expect(body.internalReason).toBeUndefined();
    expect(mocks.effective).toHaveBeenCalledTimes(1);
  });
});
