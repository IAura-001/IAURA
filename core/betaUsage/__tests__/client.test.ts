import { afterEach, describe, expect, it, vi } from "vitest";
import { trackBetaUsage } from "../client";

describe("trackBetaUsage", () => {
  afterEach(() => vi.unstubAllGlobals());

  it("never rejects the primary flow when tracking fails", async () => {
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new Error("offline")));
    await expect(trackBetaUsage({ type: "message_sent", projectId: "project-a" }))
      .resolves.toBe(false);
  });

  it("only confirms tracking when the API confirms persistence", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({
      ok: true,
      json: vi.fn().mockResolvedValue({ recorded: true }),
    }));
    await expect(trackBetaUsage({ type: "message_sent", projectId: "project-a" }))
      .resolves.toBe(true);
  });
});
