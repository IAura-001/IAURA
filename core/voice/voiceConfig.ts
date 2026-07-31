import { DEFAULT_LOCALE } from "@/core/i18n/languages";

export const voiceConfig = {
  provider: "neural" as const,

  aura: {
    language: DEFAULT_LOCALE,
    gender: "female",
    style: "futuristic-warm",
    emotion: "friendly",
  },

  neural: {
    enabled: true,
  },
} as const;
