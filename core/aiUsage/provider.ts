import type { ProviderUsage } from "./types";

interface ResponseLike {
  id?: unknown; model?: unknown;
  usage?: { input_tokens?: unknown; output_tokens?: unknown; total_tokens?: unknown;
    input_tokens_details?: { cached_tokens?: unknown; cache_write_tokens?: unknown } | null;
    output_tokens_details?: { reasoning_tokens?: unknown } | null } | null;
}
const token = (value: unknown): number | null =>
  typeof value === "number" && Number.isSafeInteger(value) && value >= 0 ? value : null;

export function parseOpenAIResponseUsage(response: ResponseLike, fallbackModel: string): ProviderUsage {
  const usage = response.usage;
  return {
    provider: "openai",
    model: typeof response.model === "string" ? response.model : fallbackModel,
    providerRequestId: typeof response.id === "string" ? response.id : null,
    inputTokens: token(usage?.input_tokens), outputTokens: token(usage?.output_tokens),
    totalTokens: token(usage?.total_tokens),
    cachedInputTokens: token(usage?.input_tokens_details?.cached_tokens),
    cacheWriteTokens: token(usage?.input_tokens_details?.cache_write_tokens),
    reasoningTokens: token(usage?.output_tokens_details?.reasoning_tokens),
    providerUsageAvailable: Boolean(usage),
  };
}

export function unknownProviderUsage(provider: ProviderUsage["provider"], model: string,
  providerRequestId: string | null = null): ProviderUsage {
  return { provider, model, providerRequestId, inputTokens: null, outputTokens: null,
    totalTokens: null, cachedInputTokens: null, cacheWriteTokens: null, reasoningTokens: null,
    providerUsageAvailable: false };
}
