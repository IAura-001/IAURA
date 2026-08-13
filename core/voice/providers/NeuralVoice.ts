import type { VoiceProvider } from "./BrowserVoice";
import type { AuraVoiceMode } from "./voiceModes";
import {
  DEFAULT_LOCALE,
  type SupportedLocale,
} from "@/core/i18n/languages";
import { splitSpeechText } from "@/core/voice/speechChunks";
import { isAbortError } from "@/utils/abort";

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
    const chunks = splitSpeechText(
      normalizedText
    );
    let pendingAudio = this.startAudioRequest(
      chunks[0],
      mode,
      language,
      controller.signal,
      "",
      chunks[1] ?? ""
    );

    try {
      for (
        let index = 0;
        index < chunks.length;
        index += 1
      ) {
        const audioBlob = await pendingAudio;

        if (controller.signal.aborted) {
          return;
        }

        const nextChunk = chunks[index + 1];

        if (nextChunk) {
          pendingAudio = this.startAudioRequest(
            nextChunk,
            mode,
            language,
            controller.signal,
            chunks[index],
            chunks[index + 2] ?? ""
          );
        }

        await this.playAudioBlob(audioBlob);
      }
    } catch (error) {
      if (!controller.signal.aborted && !isAbortError(error)) {
        throw error;
      }

      if (process.env.NODE_ENV !== "production") {
        console.info("IAURA neural voice request cancelled.");
      }
    } finally {
      if (
        this.requestController === controller
      ) {
        this.requestController = null;
      }
    }
  }

  stop(): void {
    const controller = this.requestController;
    this.requestController = null;

    try {
      controller?.abort();
    } catch (error) {
      if (!isAbortError(error)) {
        throw error;
      }
    } finally {
      try {
        if (this.currentAudio) {
          this.currentAudio.pause();
          this.currentAudio.currentTime = 0;
        }
      } finally {
        this.settlePlayback();
        this.releaseAudioUrl();
      }
    }
  }

  private startAudioRequest(
    text: string,
    mode: AuraVoiceMode,
    language: SupportedLocale,
    signal: AbortSignal,
    previousText: string,
    nextText: string
  ): Promise<Blob> {
    const request = this.requestAudio(
      text,
      mode,
      language,
      signal,
      previousText,
      nextText
    );

    // Prefetched requests can reject before the loop awaits them.
    // Observe them immediately while preserving the original rejection.
    void request.catch(() => undefined);

    return request;
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

  private async requestAudio(
    text: string,
    mode: AuraVoiceMode,
    language: SupportedLocale,
    signal: AbortSignal,
    previousText: string,
    nextText: string
  ): Promise<Blob> {
    const response = await fetch("/api/voice", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        text,
        mode,
        language,
        previousText,
        nextText,
      }),
      signal,
    });

    if (!response.ok) {
      throw new Error(
        `Neural voice request failed: ${response.status}`
      );
    }

    return response.blob();
  }

  private async playAudioBlob(
    audioBlob: Blob
  ): Promise<void> {
    const audioUrl =
      URL.createObjectURL(audioBlob);
    const audio = this.getAudioElement();

    audio.src = audioUrl;
    audio.load();
    this.currentAudioUrl = audioUrl;

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
