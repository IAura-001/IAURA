import { afterEach, describe, expect, it, vi } from "vitest";

import { NeuralVoiceProvider } from "@/core/voice/providers/NeuralVoice";

describe("NeuralVoiceProvider cancellation", () => {
  afterEach(() => vi.restoreAllMocks());

  it("settles an intentionally aborted fetch without surfacing a critical error", async () => {
    vi.spyOn(console, "info").mockImplementation(() => undefined);
    vi.stubGlobal(
      "fetch",
      vi.fn().mockRejectedValue(new DOMException("cancelled", "AbortError")),
    );
    const provider = new NeuralVoiceProvider();

    await expect(provider.speak("Hola")).resolves.toBeUndefined();
  });
});
