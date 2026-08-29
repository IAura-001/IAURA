import { describe, expect, it, vi } from "vitest";
import { activateHandsFreeVoice } from "../handsFreeActivation";

describe("Hands-Free activation", () => {
  it("reaches the pre-existing continuous listening path in order", () => {
    const order: string[] = [];
    const startContinuousListening = vi.fn(() => { order.push("listen"); });
    activateHandsFreeVoice({
      setLive: (active) => order.push(`live:${active}`),
      setVoiceMode: (active) => order.push(`voice:${active}`),
      unlockAudio: () => { order.push("unlock"); },
      startContinuousListening,
    });
    expect(order).toEqual(["live:true", "voice:true", "unlock", "listen"]);
    expect(startContinuousListening).toHaveBeenCalledTimes(1);
  });
});
