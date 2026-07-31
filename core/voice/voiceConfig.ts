export const voiceConfig = {
  provider: "neural" as const,

  aura: {
    language: "es-419",
    gender: "female",
    style: "futuristic-warm",
    emotion: "friendly",
  },

  neural: {
    enabled: true,
  },
} as const;