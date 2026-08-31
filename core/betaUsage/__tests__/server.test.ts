import { describe, expect, it } from "vitest";
import { classifyLifecycle, FounderUsageAccessError, FounderUsageServerError, founderUsageResult,
  type UsageRpcRow } from "../founder";

const now = new Date("2026-08-24T12:00:00Z");
function row(overrides: Partial<UsageRpcRow> = {}): UsageRpcRow {
  return { user_id: "member", email: "member@example.com", display_name: null,
    registered_at: "2026-08-01T00:00:00Z", beta_joined_at: "2026-08-01T01:00:00Z",
    last_sign_in_at: null, last_active_at: null, project_count: 0, conversation_count: 0,
    message_count: 0, meaningful_interaction_count: 0, latest_milestone: null,
    evidence_source: "none", data_quality_issues: [], ...overrides };
}

describe("founder beta operations", () => {
  it("classifies registered-only users as never activated", () => {
    expect(founderUsageResult([row()], null, now).users[0]).toMatchObject({
      activationStatus: "REGISTERED_ONLY", lifecycleStatus: "NEVER_ACTIVATED",
    });
  });
  it("activates only the canonical derived activation event", () => {
    expect(founderUsageResult([row({ meaningful_interaction_count: 1,
      activated_at: "2026-08-24T00:00:00Z",
      message_count: 1, last_active_at: "2026-08-24T00:00:00Z" })], null, now).users[0])
      .toMatchObject({ activationStatus: "ACTIVATED", lifecycleStatus: "ACTIVE" });
  });
  it.each([
    ["2026-08-18T12:00:00Z", "ACTIVE"],
    ["2026-08-10T12:00:00Z", "AT_RISK"],
    ["2026-07-01T12:00:00Z", "DORMANT"],
  ] as const)("classifies activity at %s as %s", (lastActiveAt, expected) => {
    expect(classifyLifecycle(1, lastActiveAt, now)).toBe(expected);
  });
  it("computes summary and surfaces missing metadata without crashing", () => {
    const result = founderUsageResult([
      row({ data_quality_issues: ["MISSING_PROFILE"] }),
      row({ user_id: "active", meaningful_interaction_count: 3, message_count: 3,
        activated_at: "2026-08-24T00:00:00Z",
        last_active_at: "2026-08-24T00:00:00Z" }),
    ], null, now);
    expect(result.summary).toMatchObject({ totalRegistered: 2, activated: 1,
      neverActivated: 1, active: 1, totalMeaningfulInteractions: 3,
      usersWithDataQualityIssues: 1 });
  });
  it("fails closed only as authorization for a denied RPC", () => {
    expect(() => founderUsageResult(null, { code: "42501" })).toThrow(FounderUsageAccessError);
    expect(() => founderUsageResult(null, { code: "XX000" })).toThrow(FounderUsageServerError);
  });
});
