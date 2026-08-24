export interface AiCostRpcRow {
  scope: "today" | "7d" | "30d" | "user_30d";
  user_id: string | null; email: string | null; operations: number; failed_operations: number;
  input_tokens: number; output_tokens: number; total_tokens: number;
  estimated_cost_usd: number; unpriced_operations: number; last_operation_at: string | null;
  active_users: number | null; cost_per_active_user: number | null;
  anomaly_status: "NORMAL" | "ELEVATED" | "HIGH" | "REVIEW";
  limit_operations_24h: number | null; limit_max_operations_24h: number;
}
export class FounderAiCostAccessError extends Error {}
export class FounderAiCostServerError extends Error {}
export function parseFounderAiCost(data: AiCostRpcRow[] | null, error: { code?: string } | null) {
  if (error?.code === "42501") throw new FounderAiCostAccessError();
  if (error) throw new FounderAiCostServerError();
  const rows = data ?? [];
  const summary = Object.fromEntries(rows.filter((r) => r.scope !== "user_30d").map((r) => [r.scope, r]));
  const users = rows.filter((r) => r.scope === "user_30d").sort((a,b) =>
    Number(b.estimated_cost_usd)-Number(a.estimated_cost_usd) || Number(b.total_tokens)-Number(a.total_tokens)
    || String(a.user_id).localeCompare(String(b.user_id)));
  return { summary, users };
}
