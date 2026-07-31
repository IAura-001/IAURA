import { voiceConfig } from "./voiceConfig";
import { NeuralVoiceProvider } from "./providers/NeuralVoice";
import type { AuraVoiceMode } from "./providers/voiceModes";
import type { SupportedLocale } from "@/core/i18n/languages";

import {
  BrowserVoiceProvider,
  type VoiceProvider,
} from "./providers/BrowserVoice";

type VoiceProviderMode = "browser" | "neural";

const CURRENT_VOICE_MODE: VoiceProviderMode =
  voiceConfig.provider === "neural" ? "neural" : "browser";

export interface VoiceEngine {
  unlock(): Promise<void>;
  speak(
    text: string,
    mode?: AuraVoiceMode,
    language?: SupportedLocale
  ): Promise<void>;
  stop(): void;
}

class IAURAVoiceEngine implements VoiceEngine {
  private provider: VoiceProvider;

  constructor() {
    this.provider = this.createProvider(CURRENT_VOICE_MODE);
  }

  private createProvider(mode: VoiceProviderMode): VoiceProvider {
    if (mode === "neural") {
      return new NeuralVoiceProvider();
    }

    return new BrowserVoiceProvider();
  }

  async unlock(): Promise<void> {
    return this.provider.unlock();
  }

  async speak(
    text: string,
    mode?: AuraVoiceMode,
    language?: SupportedLocale
  ): Promise<void> {
    return this.provider.speak(
      text,
      mode,
      language
    );
  }

  stop(): void {
    this.provider.stop();
  }
}

export const voiceEngine = new IAURAVoiceEngine();
