import { describe, expect, it } from "vitest";
import { estimateTokenCost, AI_PRICING_VERSION } from "../pricing";
import { parseOpenAIResponseUsage } from "../provider";

describe("AI usage and pricing", () => {
  it("parses authoritative Responses usage details", () => {
    expect(parseOpenAIResponseUsage({ id: "resp_1", model: "gpt-5.6-luna", usage: {
      input_tokens: 1000, output_tokens: 200, total_tokens: 1200,
      input_tokens_details: { cached_tokens: 400 }, output_tokens_details: { reasoning_tokens: 50 },
    }}, "fallback")).toMatchObject({ providerRequestId: "resp_1", inputTokens: 1000,
      outputTokens: 200, totalTokens: 1200, cachedInputTokens: 400,
      cacheWriteTokens: null, reasoningTokens: 50, providerUsageAvailable: true });
  });
  it("represents missing usage as unknown rather than zero", () => {
    expect(parseOpenAIResponseUsage({ id: "resp_2", model: "unknown" }, "fallback"))
      .toMatchObject({ inputTokens: null, outputTokens: null, totalTokens: null,
        providerUsageAvailable: false });
  });
  it("calculates known model cost with cached input and persists a pricing version", () => {
    const usage = parseOpenAIResponseUsage({ model: "gpt-5.6-luna", usage: {
      input_tokens: 1_000_000, output_tokens: 1_000_000, total_tokens: 2_000_000,
      input_tokens_details: { cached_tokens: 500_000 }, output_tokens_details: { reasoning_tokens: 0 },
    }}, "fallback");
    expect(estimateTokenCost(usage)).toEqual({ estimatedCostUsd: 2.02, pricingVersion: AI_PRICING_VERSION });
  });
  it("never prices an unknown model as zero", () => {
    const usage = parseOpenAIResponseUsage({ model: "future-model", usage: {
      input_tokens: 1, output_tokens: 1, total_tokens: 2,
    }}, "fallback");
    expect(estimateTokenCost(usage)).toEqual({ estimatedCostUsd: null, pricingVersion: null });
  });
  it("applies cache-write and long-context pricing without double counting input", () => {
    const usage = parseOpenAIResponseUsage({ model: "gpt-5.6-luna", usage: {
      input_tokens: 300_000, output_tokens: 100_000, total_tokens: 400_000,
      input_tokens_details: { cached_tokens: 100_000, cache_write_tokens: 50_000 },
    }}, "fallback");
    expect(estimateTokenCost(usage)).toEqual({ estimatedCostUsd: 0.269, pricingVersion: AI_PRICING_VERSION });
  });
  it("rejects malformed token metadata and never prices unavailable usage", () => {
    const malformed = parseOpenAIResponseUsage({ model: "gpt-5.6-luna", usage: {
      input_tokens: Number.MAX_SAFE_INTEGER + 1, output_tokens: -1, total_tokens: 0.5,
    }}, "fallback");
    expect(malformed).toMatchObject({ inputTokens: null, outputTokens: null, totalTokens: null });
    expect(estimateTokenCost({ ...malformed, inputTokens: 1, outputTokens: 1,
      providerUsageAvailable: false })).toEqual({ estimatedCostUsd: null, pricingVersion: null });
  });
});
