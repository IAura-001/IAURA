
export const AI_MODELS = {
  DEFAULT: "gpt-5.5",
  FAST: "gpt-5.5-mini",
  REASONING: "gpt-5.5",
} as const;

export type AIModel =
  (typeof AI_MODELS)[keyof typeof AI_MODELS];