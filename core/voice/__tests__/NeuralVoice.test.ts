import {
  afterEach,
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from "vitest";

import { NeuralVoiceProvider } from "@/core/voice/providers/NeuralVoice";

function deferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (error: unknown) => void;
  const promise = new Promise<T>((resolvePromise, rejectPromise) => {
    resolve = resolvePromise;
    reject = rejectPromise;
  });

  return { promise, resolve, reject };
}

function response(blob = new Blob(["audio"])): Response {
  return {
    ok: true,
    blob: vi.fn().mockResolvedValue(blob),
  } as unknown as Response;
}

function abortableRequest(signal: AbortSignal): Promise<Response> {
  return new Promise((_, reject) => {
    signal.addEventListener("abort", () => {
      reject(new DOMException("cancelled", "AbortError"));
    });
  });
}

class AudioMock {
  src = "";
  preload = "";
  currentTime = 9;
  onended: (() => void) | null = null;
  onerror: (() => void) | null = null;
  play = vi.fn(() => new Promise<void>(() => undefined));
  pause = vi.fn();
  load = vi.fn();
  setAttribute = vi.fn();
  removeAttribute = vi.fn();
}

describe("NeuralVoiceProvider cancellation", () => {
  let audios: AudioMock[];

  beforeEach(() => {
    audios = [];
    class AudioConstructorMock extends AudioMock {
      constructor() {
        super();
        audios.push(this);
      }
    }
    vi.stubGlobal("Audio", AudioConstructorMock);
    vi.stubGlobal("URL", {
      createObjectURL: vi.fn(() => "blob:voice"),
      revokeObjectURL: vi.fn(),
    });
    vi.spyOn(console, "info").mockImplementation(() => undefined);
  });

  afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  it("safely cancels an initial pending request", async () => {
    const fetchMock = vi.fn((_url, init: RequestInit) =>
      abortableRequest(init.signal as AbortSignal)
    );
    vi.stubGlobal("fetch", fetchMock);
    const provider = new NeuralVoiceProvider();
    const speaking = provider.speak("Hola");

    await vi.waitFor(() => expect(fetchMock).toHaveBeenCalledOnce());
    expect(() => provider.stop()).not.toThrow();
    await expect(speaking).resolves.toBeUndefined();
  });

  it("stops current audio and safely cancels a prefetched request", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(response())
      .mockImplementationOnce((_url, init: RequestInit) =>
        abortableRequest(init.signal as AbortSignal)
      );
    vi.stubGlobal("fetch", fetchMock);
    const provider = new NeuralVoiceProvider();
    const text = `${"Primera frase larga. ".repeat(10)}Segunda frase.`;
    const speaking = provider.speak(text);

    await vi.waitFor(() => {
      expect(fetchMock).toHaveBeenCalledTimes(2);
      expect(audios[0]?.play).toHaveBeenCalledOnce();
    });

    provider.stop();

    expect(audios[0].pause).toHaveBeenCalledOnce();
    expect(audios[0].currentTime).toBe(0);
    await expect(speaking).resolves.toBeUndefined();
    expect(URL.revokeObjectURL).toHaveBeenCalledWith("blob:voice");
  });

  it("cleans up playback when there is no prefetch", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(response()));
    const provider = new NeuralVoiceProvider();
    const speaking = provider.speak("Una frase");

    await vi.waitFor(() => expect(audios[0]?.play).toHaveBeenCalledOnce());
    provider.stop();

    expect(audios[0].pause).toHaveBeenCalledOnce();
    expect(audios[0].currentTime).toBe(0);
    expect(audios[0].onended).toBeNull();
    expect(audios[0].onerror).toBeNull();
    expect(audios[0].removeAttribute).toHaveBeenCalledWith("src");
    expect(URL.revokeObjectURL).toHaveBeenCalledWith("blob:voice");
    await expect(speaking).resolves.toBeUndefined();
  });

  it("is safe when stopped repeatedly with nothing active", () => {
    const provider = new NeuralVoiceProvider();

    expect(() => provider.stop()).not.toThrow();
    expect(() => provider.stop()).not.toThrow();
  });

  it("cleans audio before surfacing an unexpected synchronous abort failure", async () => {
    const NativeAbortController = AbortController;
    class ThrowingAbortController extends NativeAbortController {
      abort(): void {
        throw new Error("abort listener failed");
      }
    }
    vi.stubGlobal("AbortController", ThrowingAbortController);
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(response()));
    const provider = new NeuralVoiceProvider();
    const speaking = provider.speak("Una frase");

    await vi.waitFor(() => expect(audios[0]?.play).toHaveBeenCalledOnce());
    expect(() => provider.stop()).toThrow("abort listener failed");
    expect(audios[0].pause).toHaveBeenCalledOnce();
    expect(audios[0].currentTime).toBe(0);
    expect(URL.revokeObjectURL).toHaveBeenCalledWith("blob:voice");
    await expect(speaking).resolves.toBeUndefined();
  });

  it("still surfaces a genuine request failure", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockRejectedValue(new Error("network failed"))
    );
    const provider = new NeuralVoiceProvider();

    await expect(provider.speak("Hola")).rejects.toThrow("network failed");
  });

  it("still surfaces a genuine playback failure", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(response()));
    const provider = new NeuralVoiceProvider();
    const speaking = provider.speak("Hola");

    await vi.waitFor(() => expect(audios[0]?.play).toHaveBeenCalledOnce());
    audios[0].onerror?.();

    await expect(speaking).rejects.toThrow(
      "IAURA could not play the neural voice."
    );
  });

  it("can speak normally after a cancelled request", async () => {
    const first = deferred<Response>();
    const fetchMock = vi
      .fn()
      .mockImplementationOnce((_url, init: RequestInit) => {
        const signal = init.signal as AbortSignal;
        signal.addEventListener("abort", () => {
          first.reject(new DOMException("cancelled", "AbortError"));
        });
        return first.promise;
      })
      .mockResolvedValueOnce(response());
    vi.stubGlobal("fetch", fetchMock);
    const provider = new NeuralVoiceProvider();
    const cancelled = provider.speak("Primera");

    await vi.waitFor(() => expect(fetchMock).toHaveBeenCalledOnce());
    provider.stop();
    await expect(cancelled).resolves.toBeUndefined();

    const next = provider.speak("Segunda");
    await vi.waitFor(() => expect(audios[0]?.play).toHaveBeenCalledOnce());
    audios[0].onended?.();

    await expect(next).resolves.toBeUndefined();
  });
});
