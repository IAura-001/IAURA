import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ read: vi.fn(), has: vi.fn(), clear: vi.fn(), membership: vi.fn(), claim: vi.fn() }));
vi.mock("../claimContext", () => ({ readClaimContext: mocks.read, hasClaimContextCookie: mocks.has, clearClaimContextCookie: mocks.clear }));
vi.mock("../membership", () => ({ getCurrentBetaMembership: mocks.membership, claimCurrentUserBetaInvite: mocks.claim }));

import { completePostAuthClaim } from "../claimFlow";

describe("automatic post-Auth invite claim", () => {
  beforeEach(() => {
    mocks.read.mockReset().mockReturnValue("a".repeat(32));
    mocks.has.mockReset().mockReturnValue(true);
    mocks.clear.mockReset();
    mocks.membership.mockReset().mockResolvedValue(null);
    mocks.claim.mockReset().mockResolvedValue({ role: "member", status: "active" });
  });

  it("claims and clears context before entering IAURA", async () => {
    const response = await completePostAuthClaim(new Request("https://vaeora.test/api/auth/login"), "/iaura");
    expect(mocks.claim).toHaveBeenCalledWith("a".repeat(32));
    expect(mocks.clear).toHaveBeenCalledOnce();
    expect(response.headers.get("location")).toBe("https://vaeora.test/access?next=%2Fiaura");
  });

  it("clears context without consuming capacity for an active member", async () => {
    mocks.membership.mockResolvedValue({ role: "member", status: "active" });
    await completePostAuthClaim(new Request("https://vaeora.test/api/auth/login"), "/iaura");
    expect(mocks.claim).not.toHaveBeenCalled();
    expect(mocks.clear).toHaveBeenCalledOnce();
  });

  it("clears terminal claim failures and exposes only a stable marker", async () => {
    mocks.claim.mockRejectedValue(new Error("database detail"));
    const response = await completePostAuthClaim(new Request("https://vaeora.test/api/auth/login"), "/iaura");
    expect(response.headers.get("location")).toBe("https://vaeora.test/iaura?invite=unavailable");
    expect(mocks.clear).toHaveBeenCalledOnce();
  });

  it("preserves the original redirect when no context exists", async () => {
    mocks.read.mockReturnValue(null);
    mocks.has.mockReturnValue(false);
    const response = await completePostAuthClaim(new Request("https://vaeora.test/api/auth/login"), "/iaura?view=projects");
    expect(response.headers.get("location")).toBe("https://vaeora.test/access?next=%2Fiaura%3Fview%3Dprojects");
    expect(mocks.claim).not.toHaveBeenCalled();
  });

  it("clears a forged or expired context before continuing", async () => {
    mocks.read.mockReturnValue(null);
    mocks.has.mockReturnValue(true);
    await completePostAuthClaim(new Request("https://vaeora.test/api/auth/login"), "/iaura");
    expect(mocks.clear).toHaveBeenCalledOnce();
    expect(mocks.claim).not.toHaveBeenCalled();
  });
});
