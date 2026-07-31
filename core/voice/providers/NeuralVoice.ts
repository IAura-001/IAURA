import type { VoiceProvider } from "./BrowserVoice";
import type { AuraVoiceMode } from "./voiceModes";
import {
  DEFAULT_LOCALE,
  type SupportedLocale,
} from "@/core/i18n/languages";

const SILENT_AUDIO_DATA_URL =
  "data:audio/wav;base64,UklGRigAAABXQVZFZm10IBAAAAABAAEAQB8AAEAfAAABAAgAZGF0YQQAAACAgICA";

export class NeuralVoiceProvider implements VoiceProvider {
  private currentAudio: HTMLAudioElement | null = null;
  private currentAudioUrl: string | null = null;
  private requestController: AbortController | null = null;
  private audioUnlocked = false;
  private playbackSettlement: {
    resolve: () => void;
    reject: (error: unknown) => void;
  } | null = null;

  async unlock(): Promise<void> {
    if (
      typeof window === "undefined" ||
      this.audioUnlocked
    ) {
      return;
    }

    const audio = this.getAudioElement();

    audio.src = SILENT_AUDIO_DATA_URL;
    audio.load();

    try {
      await audio.play();
      audio.pause();
      audio.currentTime = 0;
      this.audioUnlocked = true;
    } catch {
      // A later user gesture can retry the unlock.
    }
  }

  async speak(
    text: string,
    mode: AuraVoiceMode = "companion",
    language: SupportedLocale = DEFAULT_LOCALE
  ): Promise<void> {
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
        mode,
        language,
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
    const audio = this.getAudioElement();

    audio.src = audioUrl;
    audio.load();

    this.currentAudioUrl = audioUrl;
    this.requestController = null;

    await new Promise<void>((resolve, reject) => {
      this.playbackSettlement = {
        resolve,
        reject,
      };

      audio.onended = () => {
        this.settlePlayback();
      };

      audio.onerror = () => {
        this.settlePlayback(
          new Error("IAURA could not play the neural voice.")
        );
      };

      audio.play().catch((error) => {
        this.settlePlayback(error);
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

    this.settlePlayback();
    this.releaseAudioUrl();
  }

  private getAudioElement(): HTMLAudioElement {
    if (!this.currentAudio) {
      const audio = new Audio();

      audio.preload = "auto";
      audio.setAttribute("playsinline", "");
      this.currentAudio = audio;
    }

    return this.currentAudio;
  }

  private settlePlayback(error?: unknown): void {
    const settlement = this.playbackSettlement;

    this.playbackSettlement = null;

    if (this.currentAudio) {
      this.currentAudio.onended = null;
      this.currentAudio.onerror = null;
    }

    this.releaseAudioUrl();

    if (!settlement) {
      return;
    }

    if (error) {
      settlement.reject(error);
      return;
    }

    settlement.resolve();
  }

  private releaseAudioUrl(): void {
    if (!this.currentAudioUrl) {
      return;
    }

    if (this.currentAudio) {
      this.currentAudio.removeAttribute("src");
      this.currentAudio.load();
    }

    URL.revokeObjectURL(this.currentAudioUrl);
    this.currentAudioUrl = null;
  }
}
