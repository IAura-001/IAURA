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
import { AiEntitlementError, AiSafetyLimitError } from "../types";

describe("AI usage reservation configuration", () => {
  beforeEach(() => {
    mocks.createAdmin.mockReset();
    mocks.createAdmin.mockReturnValue({});
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

  it("passes project and image tier to the single authoritative reservation RPC", async () => {
    await reserveAiUsage(new Request("https://example.test/api/creative/image"),
      "creative_image", "request-a", "project-a", "premium");
    expect(mocks.rpc).toHaveBeenCalledWith("reserve_ai_usage_operation", {
      requested_operation_type: "creative_image", requested_request_id: "request-a",
      requested_project_id: "project-a", requested_image_tier: "premium", requested_entitlement_units: 1,
    });
  });

  it("keeps commercial denial distinct from safety and system failures", async () => {
    mocks.rpc.mockResolvedValueOnce({ data: null, error: { code: "P0002", message: "AI_ALLOWANCE_EXHAUSTED" } });
    await expect(reserveAiUsage(new Request("https://example.test"), "chat"))
      .rejects.toEqual(expect.objectContaining<Partial<AiEntitlementError>>({ name: "AiEntitlementError",
        reason: "AI_ALLOWANCE_EXHAUSTED" }));
    mocks.rpc.mockResolvedValueOnce({ data: null, error: { code: "P0001", message: "SAFETY_LIMIT_REACHED" } });
    await expect(reserveAiUsage(new Request("https://example.test"), "chat")).rejects.toBeInstanceOf(AiSafetyLimitError);
    mocks.rpc.mockResolvedValueOnce({ data: null, error: { code: "XX000", message: "database unavailable" } });
    await expect(reserveAiUsage(new Request("https://example.test"), "chat"))
      .rejects.toThrow("AI usage guardrail is unavailable");
  });
});
