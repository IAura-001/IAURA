import type { VoiceProvider } from "./BrowserVoice";

export class NeuralVoiceProvider implements VoiceProvider {
  async speak(text: string): Promise<void> {
    if (typeof window === "undefined") return;

    const voices = window.speechSynthesis.getVoices();

    const femaleVoice =
      voices.find((voice) =>
        voice.name.toLowerCase().includes("female")
      ) ||
      voices.find((voice) =>
        voice.lang.startsWith("es")
      );

    const utterance = new SpeechSynthesisUtterance(text);

    utterance.lang = "es-LATAM";
    utterance.rate = 0.9;
    utterance.pitch = 1.15;
    utterance.volume = 1;

    if (femaleVoice) {
      utterance.voice = femaleVoice;
    }

    window.speechSynthesis.speak(utterance);
  }

  stop(): void {
    if (typeof window === "undefined") return;

    window.speechSynthesis.cancel();
  }
}