import { act, renderHook, waitFor } from "@testing-library/react";
import {
  afterEach,
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from "vitest";

import { detectVoiceCaptureMode } from "../../core/voice/captureMode";

const voiceEngineMock = vi.hoisted(() => ({
  unlock: vi.fn(() => Promise.resolve()),
  speak: vi.fn(() => Promise.resolve()),
  stop: vi.fn(),
}));

vi.mock("@/core/voice/voiceEngine", () => ({
  voiceEngine: voiceEngineMock,
}));

import { useVoice } from "@/hooks/useVoice";

function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((resolvePromise) => {
    resolve = resolvePromise;
  });
  return { promise, resolve };
}

class RecognitionMock {
  static latest: RecognitionMock | null = null;
  lang = "";
  continuous = false;
  interimResults = false;
  onstart: (() => void) | null = null;
  onresult = null;
  onend: (() => void) | null = null;
  onerror = null;
  start = vi.fn(() => this.onstart?.());
  stop = vi.fn(() => this.onend?.());
  abort = vi.fn(() => this.onend?.());

  constructor() {
    RecognitionMock.latest = this;
  }
}

describe("IAURA voice capture selection", () => {
  it("uses reliable recording on secure phones", () => {
    expect(
      detectVoiceCaptureMode({
        isMobile: true,
        isSecureContext: true,
        canRecord: true,
        hasSpeechRecognition: true,
      })
    ).toBe("media-recorder");
  });

  it("never opens a native media picker on insecure links", () => {
    expect(
      detectVoiceCaptureMode({
        isMobile: true,
        isSecureContext: false,
        canRecord: false,
        hasSpeechRecognition: true,
      })
    ).toBe("secure-context-required");
  });

  it("keeps browser recognition on desktop", () => {
    expect(
      detectVoiceCaptureMode({
        isMobile: false,
        isSecureContext: true,
        canRecord: false,
        hasSpeechRecognition: true,
      })
    ).toBe("speech-recognition");
  });
});

describe("useVoice safe stop", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    window.localStorage.clear();
    Object.defineProperty(window, "isSecureContext", {
      configurable: true,
      value: true,
    });
    Object.defineProperty(navigator, "userAgent", {
      configurable: true,
      value: "Desktop",
    });
    Object.defineProperty(navigator, "maxTouchPoints", {
      configurable: true,
      value: 0,
    });
    Object.defineProperty(window, "SpeechRecognition", {
      configurable: true,
      value: RecognitionMock,
    });
    Object.defineProperty(window, "webkitSpeechRecognition", {
      configurable: true,
      value: undefined,
    });
    vi.stubGlobal("MediaRecorder", undefined);
  });

  afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  it("turns Voice off, cancels recognition, stops speech, and ends idle", async () => {
    const { result } = renderHook(() => useVoice());
    await waitFor(() =>
      expect(result.current.captureMode).toBe("speech-recognition")
    );

    await act(async () => {
      await result.current.startListening();
    });
    expect(result.current.state).toBe("listening");

    act(() => result.current.setVoiceMode(false));

    expect(RecognitionMock.latest?.abort).toHaveBeenCalledOnce();
    expect(voiceEngineMock.stop).toHaveBeenCalledOnce();
    expect(window.localStorage.getItem("iaura.voice.enabled")).toBe("false");
    expect(result.current.voiceMode).toBe(false);
    expect(result.current.state).toBe("idle");
  });

  it("does not let an old cancelled speech overwrite a newer operation", async () => {
    const oldSpeech = deferred<void>();
    const newSpeech = deferred<void>();
    voiceEngineMock.speak
      .mockImplementationOnce(() => oldSpeech.promise)
      .mockImplementationOnce(() => newSpeech.promise);
    const { result } = renderHook(() => useVoice());

    let first!: Promise<void>;
    act(() => {
      first = result.current.speak("Primera");
    });
    expect(result.current.state).toBe("speaking");

    act(() => {
      result.current.setVoiceMode(false);
      result.current.setVoiceMode(true);
    });

    let second!: Promise<void>;
    act(() => {
      second = result.current.speak("Segunda");
    });
    expect(result.current.state).toBe("speaking");

    await act(async () => {
      oldSpeech.resolve();
      await first;
    });
    expect(result.current.state).toBe("speaking");

    await act(async () => {
      newSpeech.resolve();
      await second;
    });
    expect(result.current.state).toBe("idle");
  });

  it("discards a cancelled recording without transcribing or re-enabling Voice", async () => {
    const track = { readyState: "live", stop: vi.fn() };
    const stream = {
      getTracks: vi.fn(() => [track]),
      getAudioTracks: vi.fn(() => [track]),
    } as unknown as MediaStream;
    const fetchMock = vi.fn();

    class MediaRecorderMock {
      static latest: MediaRecorderMock | null = null;
      static isTypeSupported = vi.fn(() => true);
      state: RecordingState = "inactive";
      mimeType = "audio/webm";
      ondataavailable: ((event: BlobEvent) => void) | null = null;
      onerror: (() => void) | null = null;
      onstop: (() => void) | null = null;
      start = vi.fn(() => {
        this.state = "recording";
      });
      stop = vi.fn(() => {
        this.state = "inactive";
        this.onstop?.();
      });

      constructor() {
        MediaRecorderMock.latest = this;
      }
    }

    Object.defineProperty(navigator, "userAgent", {
      configurable: true,
      value: "iPhone",
    });
    Object.defineProperty(navigator, "mediaDevices", {
      configurable: true,
      value: { getUserMedia: vi.fn().mockResolvedValue(stream) },
    });
    vi.stubGlobal("MediaRecorder", MediaRecorderMock);
    vi.stubGlobal("fetch", fetchMock);

    const { result } = renderHook(() => useVoice());
    await waitFor(() =>
      expect(result.current.captureMode).toBe("media-recorder")
    );
    await act(async () => {
      await result.current.startListening();
    });

    act(() => result.current.setVoiceMode(false));

    expect(MediaRecorderMock.latest?.stop).toHaveBeenCalledOnce();
    expect(track.stop).toHaveBeenCalled();
    expect(fetchMock).not.toHaveBeenCalled();
    expect(window.localStorage.getItem("iaura.voice.enabled")).toBe("false");
    expect(result.current.voiceMode).toBe(false);
    expect(result.current.state).toBe("idle");
  });

  it("keeps Voice off when pending microphone access finishes after cancellation", async () => {
    const microphone = deferred<MediaStream>();
    const track = { readyState: "live", stop: vi.fn() };
    const stream = {
      getTracks: vi.fn(() => [track]),
      getAudioTracks: vi.fn(() => [track]),
    } as unknown as MediaStream;

    class MediaRecorderMock {
      static isTypeSupported = vi.fn(() => true);
    }

    Object.defineProperty(navigator, "userAgent", {
      configurable: true,
      value: "iPhone",
    });
    Object.defineProperty(navigator, "mediaDevices", {
      configurable: true,
      value: { getUserMedia: vi.fn(() => microphone.promise) },
    });
    vi.stubGlobal("MediaRecorder", MediaRecorderMock);

    const { result } = renderHook(() => useVoice());
    await waitFor(() =>
      expect(result.current.captureMode).toBe("media-recorder")
    );

    let listening!: Promise<void>;
    act(() => {
      listening = result.current.startListening();
    });
    act(() => result.current.setVoiceMode(false));
    await act(async () => {
      microphone.resolve(stream);
      await listening;
    });

    expect(track.stop).toHaveBeenCalledOnce();
    expect(window.localStorage.getItem("iaura.voice.enabled")).toBe("false");
    expect(result.current.state).toBe("idle");
  });

  it("retains unlock and speech behavior after Voice is re-enabled", async () => {
    const { result } = renderHook(() => useVoice());

    act(() => result.current.setVoiceMode(false));
    act(() => result.current.setVoiceMode(true));
    await act(async () => {
      await result.current.speak("De nuevo");
    });

    expect(voiceEngineMock.unlock).toHaveBeenCalled();
    expect(voiceEngineMock.speak).toHaveBeenCalledWith(
      "De nuevo",
      "companion",
      "es-419"
    );
    expect(result.current.state).toBe("idle");
  });
});
