import { beforeEach, describe, expect, it, vi } from "vitest";
const mocks = vi.hoisted(() => ({ getUser: vi.fn(), getCosts: vi.fn() }));
vi.mock("@/core/auth/session", async () => { const { NextResponse } = await import("next/server"); return {
  getAuthenticatedUser: mocks.getUser,
  authenticationRequiredResponse: () => NextResponse.json({ error: "auth" }, { status: 401 }),
}; });
vi.mock("@/core/aiUsage/founderServer", async () => { const founder = await import("@/core/aiUsage/founder"); return {
  FounderAiCostAccessError: founder.FounderAiCostAccessError,
  getFounderAiCostOperations: mocks.getCosts,
}; });
import { GET } from "./route";
import { FounderAiCostAccessError } from "@/core/aiUsage/founder";
describe("GET /api/ai-usage", () => {
  beforeEach(() => { mocks.getUser.mockReset().mockResolvedValue({ id: "founder" }); mocks.getCosts.mockReset(); });
  it("returns founder cost analytics", async () => {
    mocks.getCosts.mockResolvedValue({ summary: {}, users: [] });
    expect((await GET()).status).toBe(200);
  });
  it("denies a normal beta user", async () => {
    mocks.getCosts.mockRejectedValue(new FounderAiCostAccessError());
    expect((await GET()).status).toBe(403);
  });
  it("denies unauthenticated users before querying costs", async () => {
    mocks.getUser.mockResolvedValue(null);
    expect((await GET()).status).toBe(401);
    expect(mocks.getCosts).not.toHaveBeenCalled();
  });
});
