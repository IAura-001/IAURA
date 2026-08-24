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
