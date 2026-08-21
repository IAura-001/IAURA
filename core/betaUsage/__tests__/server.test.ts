import { describe, expect, it } from "vitest";
import { FounderUsageAccessError, founderUsageResult } from "../founder";

describe("founder beta usage", () => {
  it("preserves an inferred baseline for users active before explicit tracking", async () => {
    const result = founderUsageResult([{
      user_id: "existing", email: "member@example.com", display_name: "Member",
      joined_at: "2026-08-01T00:00:00Z", account_created_at: "2026-08-01T00:00:00Z",
      last_sign_in_at: "2026-08-18T00:00:00Z", last_active_at: "2026-08-18T00:00:00Z",
      project_count: 2, conversation_count: 1, user_message_count: 4,
      latest_milestone: "ready-to-start", usage_status: "returned", evidence_source: "inferred",
    }], null);
    expect(result).toEqual([
      expect.objectContaining({ userId: "existing", projectCount: 2, userMessageCount: 4, evidenceSource: "inferred" }),
    ]);
  });

  it("fails closed when the founder-authorized RPC denies access", async () => {
    expect(() => founderUsageResult(null, { code: "42501" }))
      .toThrow(FounderUsageAccessError);
  });
});
