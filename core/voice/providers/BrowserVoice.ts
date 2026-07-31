import type { AuraVoiceMode } from "./voiceModes";
import { auraVoiceModes } from "./voiceModes";
import {
  DEFAULT_LOCALE,
  type SupportedLocale,
} from "@/core/i18n/languages";

export interface VoiceProvider {
  speak(
    text: string,
    mode?: AuraVoiceMode,
    language?: SupportedLocale
  ): Promise<void>;

  stop(): void;
}

export class BrowserVoiceProvider implements VoiceProvider {
  async speak(
    text: string,
    mode?: AuraVoiceMode,
    language: SupportedLocale = DEFAULT_LOCALE
  ): Promise<void> {
    if (typeof window === "undefined") return;

    const utterance =
      new SpeechSynthesisUtterance(text);
    const voices =
      window.speechSynthesis.getVoices();
    const normalizedLanguage =
      language.toLowerCase();
    const languageCode =
      normalizedLanguage.split("-")[0];

    const matchingVoice =
      voices.find(
        (voice) =>
          voice.lang.toLowerCase() ===
            normalizedLanguage &&
          voice.name
            .toLowerCase()
            .includes("female")
      ) ??
      voices.find(
        (voice) =>
          voice.lang.toLowerCase() ===
          normalizedLanguage
      ) ??
      voices.find(
        (voice) =>
          voice.lang
            .toLowerCase()
            .startsWith(languageCode)
      );

    if (matchingVoice) {
      utterance.voice = matchingVoice;
    }

    const style = mode
      ? auraVoiceModes[mode]
      : auraVoiceModes.future;

    utterance.lang = language;
    utterance.rate = style.pacing;
    utterance.pitch = style.warmth;
    utterance.volume = 1;

    this.stop();

    await new Promise<void>(
      (resolve, reject) => {
        utterance.onend = () => resolve();
        utterance.onerror = () =>
          reject(
            new Error(
              "IAURA could not play the browser voice."
            )
          );

        window.speechSynthesis.speak(utterance);
      }
    );
  }

  stop(): void {
    if (typeof window === "undefined") return;

    window.speechSynthesis.cancel();
  }
}
