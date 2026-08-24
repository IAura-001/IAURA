import "server-only";

import { createServerSupabaseClient } from "@/lib/supabase/server";
import { founderUsageResult, type UsageRpcRow } from "./founder";
import type { FounderBetaOperations } from "./types";
export { FounderUsageAccessError, FounderUsageServerError } from "./founder";

export async function getFounderBetaUsage(): Promise<FounderBetaOperations> {
  const supabase = await createServerSupabaseClient();
  const { data, error } = await supabase.rpc("founder_beta_usage");
  return founderUsageResult((data ?? null) as UsageRpcRow[] | null, error);
}
