
export type AuraVoiceMode =
  | "mentor"
  | "companion"
  | "focus"
  | "future";

export interface VoiceStyle {
  name: string;
  description: string;

  emotion: string;
  energy: number;
  warmth: number;
  confidence: number;

  pacing: number;
  expressiveness: number;
}

export const auraVoiceModes: Record<
  AuraVoiceMode,
  VoiceStyle
> = {
  mentor: {
    name: "Mentor",
    description:
      "Aura explica, enseña y guía con paciencia.",

    emotion: "calm",
    energy: 0.6,
    warmth: 0.8,
    confidence: 0.8,

    pacing: 0.85,
    expressiveness: 0.6,
  },

  companion: {
    name: "Companion",
    description:
      "Aura acompaña al usuario con cercanía y apoyo.",

    emotion: "friendly",
    energy: 0.7,
    warmth: 1,
    confidence: 0.75,

    pacing: 0.95,
    expressiveness: 0.8,
  },

  focus: {
    name: "Focus",
    description:
      "Aura ayuda a ejecutar objetivos con claridad.",

    emotion: "determined",
    energy: 0.9,
    warmth: 0.6,
    confidence: 1,

    pacing: 1,
    expressiveness: 0.7,
  },

  future: {
    name: "Future",
    description:
      "La identidad futurista principal de Aura.",

    emotion: "intelligent",
    energy: 0.8,
    warmth: 0.85,
    confidence: 1,

    pacing: 0.9,
    expressiveness: 0.9,
  },
};