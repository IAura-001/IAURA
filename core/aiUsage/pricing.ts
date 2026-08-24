import type { ProviderUsage } from "./types";

export const AI_PRICING_VERSION = "openai-2026-08-24-v2";
interface TokenPricing { inputPerMillion: number; cachedInputPerMillion: number; outputPerMillion: number }

// USD per one million tokens, captured from the official model pages on the
// pricing-version date. Aliases are explicit; unknown identifiers stay unknown.
export const TOKEN_PRICING: Record<string, TokenPricing> = {
  "gpt-5.6-sol": { inputPerMillion: 4, cachedInputPerMillion: 0.4, outputPerMillion: 20 },
  "gpt-5.6": { inputPerMillion: 4, cachedInputPerMillion: 0.4, outputPerMillion: 20 },
  "gpt-5.6-terra": { inputPerMillion: 2, cachedInputPerMillion: 0.2, outputPerMillion: 12 },
  "gpt-5.6-luna": { inputPerMillion: 0.2, cachedInputPerMillion: 0.02, outputPerMillion: 1.2 },
  "gpt-4o-mini-transcribe": { inputPerMillion: 1.25, cachedInputPerMillion: 1.25, outputPerMillion: 5 },
  "gpt-4o-mini-transcribe-2025-12-15": { inputPerMillion: 1.25, cachedInputPerMillion: 1.25, outputPerMillion: 5 },
};

export interface EstimatedCost { estimatedCostUsd: number | null; pricingVersion: string | null }
export function estimateTokenCost(usage: ProviderUsage): EstimatedCost {
  const pricing = usage.provider === "openai" ? TOKEN_PRICING[usage.model] : undefined;
  if (!usage.providerUsageAvailable || !pricing || usage.inputTokens === null || usage.outputTokens === null) {
    return { estimatedCostUsd: null, pricingVersion: null };
  }
  const cached = Math.min(usage.cachedInputTokens ?? 0, usage.inputTokens);
  const cacheWrite = Math.min(usage.cacheWriteTokens ?? 0, usage.inputTokens - cached);
  const uncached = usage.inputTokens - cached - cacheWrite;
  const longContext = usage.model.startsWith("gpt-5.6") && usage.inputTokens > 272_000;
  const inputMultiplier = longContext ? 2 : 1;
  const outputMultiplier = longContext ? 1.5 : 1;
  const cost = ((uncached * pricing.inputPerMillion
    + cached * pricing.cachedInputPerMillion
    + cacheWrite * pricing.inputPerMillion * 1.25) * inputMultiplier
    + usage.outputTokens * pricing.outputPerMillion * outputMultiplier) / 1_000_000;
  return { estimatedCostUsd: Number(cost.toFixed(8)), pricingVersion: AI_PRICING_VERSION };
}
