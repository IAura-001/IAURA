import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  createAdmin: vi.fn(),
  createServer: vi.fn(),
  rpc: vi.fn(),
}));

vi.mock("@/lib/supabase/admin", () => ({
  createAdminSupabaseClient: mocks.createAdmin,
}));
vi.mock("@/lib/supabase/server", () => ({
  createServerSupabaseClient: mocks.createServer,
}));

import { reserveAiUsage } from "../server";

describe("AI usage reservation configuration", () => {
  beforeEach(() => {
    mocks.createAdmin.mockReset();
    mocks.createServer.mockReset().mockResolvedValue({ rpc: mocks.rpc });
    mocks.rpc.mockReset().mockResolvedValue({ data: "reservation-id", error: null });
  });

  it("fails before the reservation RPC when the admin secret is unavailable", async () => {
    mocks.createAdmin.mockImplementation(() => {
      throw new Error("SUPABASE_SERVICE_ROLE_KEY is missing.");
    });

    await expect(
      reserveAiUsage(new Request("https://example.test/api/chat"), "chat"),
    ).rejects.toThrow("SUPABASE_SERVICE_ROLE_KEY is missing.");

    expect(mocks.createServer).not.toHaveBeenCalled();
    expect(mocks.rpc).not.toHaveBeenCalled();
  });
});
