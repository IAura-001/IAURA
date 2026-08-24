import "server-only";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { parseFounderAiCost, type AiCostRpcRow } from "./founder";
export async function getFounderAiCostOperations() {
  const supabase = await createServerSupabaseClient();
  const { data, error } = await supabase.rpc("founder_ai_cost_operations");
  return parseFounderAiCost((data ?? null) as AiCostRpcRow[] | null, error);
}
export { FounderAiCostAccessError, FounderAiCostServerError } from "./founder";
