import { describe, expect, it } from "vitest";
import { FounderAiCostAccessError, parseFounderAiCost, type AiCostRpcRow } from "../founder";
const row = (overrides: Partial<AiCostRpcRow>): AiCostRpcRow => ({ scope: "user_30d", user_id: "u",
  email: "u@example.com", operations: 1, failed_operations: 0, input_tokens: 2,
  output_tokens: 3, total_tokens: 5, estimated_cost_usd: 0.1, unpriced_operations: 0,
  last_operation_at: null, active_users: null, cost_per_active_user: null,
  anomaly_status: "NORMAL", limit_operations_24h: 1, limit_max_operations_24h: 100, ...overrides });
describe("founder AI cost parsing", () => {
  it("sorts expensive users first", () => {
    expect(parseFounderAiCost([row({ user_id: "low" }), row({ user_id: "high", estimated_cost_usd: 2 })], null)
      .users.map((u) => u.user_id)).toEqual(["high", "low"]);
  });
  it("fails closed on founder denial", () => {
    expect(() => parseFounderAiCost(null, { code: "42501" })).toThrow(FounderAiCostAccessError);
  });
});
