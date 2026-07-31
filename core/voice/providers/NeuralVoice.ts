import type { VoiceProvider } from "./BrowserVoice";

export class NeuralVoiceProvider implements VoiceProvider {
  private currentAudio: HTMLAudioElement | null = null;
  private currentAudioUrl: string | null = null;
  private requestController: AbortController | null = null;

  async speak(text: string): Promise<void> {
    if (typeof window === "undefined") return;

    const normalizedText = text.trim();

    if (!normalizedText) return;

    this.stop();

    const controller = new AbortController();
    this.requestController = controller;

    const response = await fetch("/api/voice", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        text: normalizedText,
      }),
      signal: controller.signal,
    });

    if (!response.ok) {
      throw new Error(
        `Neural voice request failed: ${response.status}`
      );
    }

    const audioBlob = await response.blob();
    const audioUrl = URL.createObjectURL(audioBlob);
    const audio = new Audio(audioUrl);

    this.currentAudio = audio;
    this.currentAudioUrl = audioUrl;
    this.requestController = null;

    await new Promise<void>((resolve, reject) => {
      audio.onended = () => {
        this.releaseAudio();
        resolve();
      };

      audio.onerror = () => {
        this.releaseAudio();
        reject(
          new Error("IAURA could not play the neural voice.")
        );
      };

      audio.play().catch((error) => {
        this.releaseAudio();
        reject(error);
      });
    });
  }

  stop(): void {
    this.requestController?.abort();
    this.requestController = null;

    if (this.currentAudio) {
      this.currentAudio.pause();
      this.currentAudio.currentTime = 0;
    }

    this.releaseAudio();
  }

  private releaseAudio(): void {
    if (this.currentAudio) {
      this.currentAudio.onended = null;
      this.currentAudio.onerror = null;
      this.currentAudio = null;
    }

    if (this.currentAudioUrl) {
      URL.revokeObjectURL(this.currentAudioUrl);
      this.currentAudioUrl = null;
    }
  }
}