import type { AuraVoiceMode } from "./voiceModes";
import { auraVoiceModes } from "./voiceModes";

export interface VoiceProvider {
  speak(
    text: string,
    mode?: AuraVoiceMode
  ): Promise<void>;

  stop(): void;
}

export class BrowserVoiceProvider implements VoiceProvider {
  async speak(
  text: string,
  mode?: AuraVoiceMode
): Promise<void> {
    if (typeof window === "undefined") return;

    const utterance =
      new SpeechSynthesisUtterance(text);
      const voices = window.speechSynthesis.getVoices();
      console.table(
  voices.map((voice) => ({
    name: voice.name,
    lang: voice.lang
  }))
);

const femaleVoice =
  voices.find((voice) =>
    voice.lang.startsWith("es") &&
    voice.name.toLowerCase().includes("female")
  ) ||
  voices.find((voice) =>
    voice.lang.startsWith("es")
  );

if (femaleVoice) {
  utterance.voice = femaleVoice;
}

    const style =
  mode
    ? auraVoiceModes[mode]
    : auraVoiceModes.future;

utterance.lang = "es-419";
utterance.rate = style.pacing;
utterance.pitch = style.warmth;
utterance.volume = 1;

    window.speechSynthesis.speak(utterance);
  }

  stop(): void {
    if (typeof window === "undefined") return;

    window.speechSynthesis.cancel();
  }
}