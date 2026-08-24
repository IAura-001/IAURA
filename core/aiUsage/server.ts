import "server-only";

import { randomUUID } from "node:crypto";
import { createAdminSupabaseClient } from "@/lib/supabase/admin";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { estimateTokenCost } from "./pricing";
import { AiSafetyLimitError, type AiOperationType, type ProviderUsage } from "./types";

export interface AiUsageReservation {
  id: string;
  complete(usage: ProviderUsage): Promise<void>;
  fail(provider: ProviderUsage["provider"], model: string, providerRequestId?: string | null): Promise<void>;
}

export async function reserveAiUsage(request: Request, operationType: AiOperationType,
  requestId: string = randomUUID()): Promise<AiUsageReservation> {
  const authenticated = await createServerSupabaseClient(request);
  const { data, error } = await authenticated.rpc("reserve_ai_usage_operation", {
    requested_operation_type: operationType, requested_request_id: requestId,
  });
  if (error) {
    if (error.code === "P0001") throw new AiSafetyLimitError(3600);
    throw new Error("AI usage guardrail is unavailable.");
  }
  const admin = createAdminSupabaseClient();
  const id = String(data);
  const update = async (values: Record<string, unknown>) => {
    try {
      const { error: updateError } = await admin.from("ai_usage_events").update(values).eq("id", id);
      if (updateError) console.error("AI usage accounting persistence failed:", { code: updateError.code, id });
    } catch (error) {
      console.error("AI usage accounting persistence failed:", {
        code: error instanceof Error ? error.name : "unknown", id,
      });
    }
  };
  return {
    id,
    async complete(usage) {
      const cost = estimateTokenCost(usage);
      await update({ status: "succeeded", provider: usage.provider, model: usage.model,
        provider_request_id: usage.providerRequestId, input_tokens: usage.inputTokens,
        output_tokens: usage.outputTokens, total_tokens: usage.totalTokens,
        cached_input_tokens: usage.cachedInputTokens, reasoning_tokens: usage.reasoningTokens,
        cache_write_tokens: usage.cacheWriteTokens,
        provider_usage_available: usage.providerUsageAvailable,
        estimated_cost_usd: cost.estimatedCostUsd, cost_pricing_version: cost.pricingVersion,
        completed_at: new Date().toISOString() });
    },
    async fail(provider, model, providerRequestId = null) {
      await update({ status: "failed", provider, model, provider_request_id: providerRequestId,
        provider_usage_available: false, completed_at: new Date().toISOString() });
    },
  };
}

export function aiLimitResponse(error: AiSafetyLimitError) {
  return Response.json({ error: "This Private Beta account has reached its temporary AI usage limit.",
    code: "VAEORA_AI_USAGE_LIMIT_REACHED" }, { status: 429,
    headers: { "Cache-Control": "no-store", "Retry-After": String(error.retryAfterSeconds) } });
}
