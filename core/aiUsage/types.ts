export const AI_OPERATION_TYPES = [
  "chat", "creative_copy", "creative_image", "transcription", "speech",
] as const;
export type AiOperationType = typeof AI_OPERATION_TYPES[number];

export interface ProviderUsage {
  provider: "openai" | "elevenlabs";
  model: string;
  providerRequestId: string | null;
  inputTokens: number | null;
  outputTokens: number | null;
  totalTokens: number | null;
  cachedInputTokens: number | null;
  cacheWriteTokens: number | null;
  reasoningTokens: number | null;
  providerUsageAvailable: boolean;
}

export class AiSafetyLimitError extends Error {
  constructor(readonly retryAfterSeconds: number) {
    super("Private Beta usage limit reached.");
    this.name = "AiSafetyLimitError";
  }
}

export type AiEntitlementReason = "CAPABILITY_NOT_ALLOWED" | "AI_ALLOWANCE_EXHAUSTED"
  | "IMAGE_ALLOWANCE_EXHAUSTED" | "IMAGE_TIER_NOT_ALLOWED" | "CONCURRENCY_LIMIT_REACHED";

export class AiEntitlementError extends Error {
  constructor(readonly reason: AiEntitlementReason) {
    super(reason);
    this.name = "AiEntitlementError";
  }
}
