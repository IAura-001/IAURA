import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ getUser: vi.fn(), rpc: vi.fn(), maybeSingle: vi.fn() }));
const query = { select: vi.fn(), eq: vi.fn(), maybeSingle: mocks.maybeSingle };
query.select.mockReturnValue(query); query.eq.mockReturnValue(query);

vi.mock("@/lib/supabase/server", () => ({
  createServerSupabaseClient: vi.fn(async () => ({
    auth: { getUser: mocks.getUser }, rpc: mocks.rpc, from: vi.fn(() => query),
  })),
}));

import { BetaClaimError, claimCurrentUserBetaInvite, getCurrentBetaMembership, recognizeBetaInvite } from "../membership";

describe("Beta membership server helper", () => {
  beforeEach(() => {
    mocks.getUser.mockReset().mockResolvedValue({ data: { user: { id: "user-a" } }, error: null });
    mocks.rpc.mockReset(); mocks.maybeSingle.mockReset();
  });

  it("invokes the RPC with only the invite token", async () => {
    mocks.rpc.mockResolvedValue({ data: { role: "member", status: "active", claimed_at: "now" }, error: null });
    await expect(claimCurrentUserBetaInvite("secret-token")).resolves.toEqual({ role: "member", status: "active", claimedAt: "now" });
    expect(mocks.rpc).toHaveBeenCalledWith("claim_beta_invite", { invite_token: "secret-token" });
  });

  it("refuses to claim without a verified user", async () => {
    mocks.getUser.mockResolvedValue({ data: { user: null }, error: new Error("invalid") });
    await expect(claimCurrentUserBetaInvite("secret-token")).rejects.toMatchObject({ kind: "unauthenticated" });
    expect(mocks.rpc).not.toHaveBeenCalled();
  });

  it("maps database uniqueness to already_member", async () => {
    mocks.rpc.mockResolvedValue({ data: null, error: { code: "23505" } });
    await expect(claimCurrentUserBetaInvite("secret-token")).rejects.toEqual(new BetaClaimError("already_member"));
  });

  it("reads only the verified user's RLS-scoped membership", async () => {
    mocks.maybeSingle.mockResolvedValue({ data: { role: "member", status: "active", claimed_at: "now" }, error: null });
    await expect(getCurrentBetaMembership()).resolves.toEqual({ role: "member", status: "active", claimedAt: "now" });
    expect(query.eq).toHaveBeenCalledWith("user_id", "user-a");
  });

  it("returns only the boolean recognition result", async () => {
    mocks.rpc.mockResolvedValue({ data: true, error: null });
    await expect(recognizeBetaInvite("secret-token")).resolves.toBe(true);
    expect(mocks.rpc).toHaveBeenCalledWith("recognize_beta_invite", { invite_token: "secret-token" });
  });
});
