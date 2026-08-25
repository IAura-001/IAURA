import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  isRequestAuthorized: vi.fn(), getAuthenticatedUser: vi.fn(),
  reserveUsage: vi.fn(), openAiSpeech: vi.fn(),
}));
vi.mock("@/core/auth/access", () => ({ isRequestAuthorized: mocks.isRequestAuthorized }));
vi.mock("@/core/auth/session", async () => {
  const { NextResponse } = await import("next/server");
  return { getAuthenticatedUser: mocks.getAuthenticatedUser,
    authenticationRequiredResponse: () => NextResponse.json({ error: "Authentication required." }, { status: 401 }) };
});
vi.mock("@/core/aiUsage/server", () => ({ reserveAiUsage: mocks.reserveUsage,
  aiLimitResponse: () => new Response(null, { status: 429 }) }));
vi.mock("openai", () => ({ default: class OpenAIMock {
  audio = { speech: { create: mocks.openAiSpeech } };
} }));

import { POST } from "./route";

const request = (signal?: AbortSignal) => new Request("https://vaeora.test/api/voice", {
  method: "POST", headers: { "Content-Type": "application/json" }, signal,
  body: JSON.stringify({ text: "Hola", language: "es-419", mode: "companion" }),
});
const reservation = () => ({ complete: vi.fn(), fail: vi.fn() });

describe("POST /api/voice", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.stubEnv("ELEVENLABS_API_KEY", "configured-key");
    vi.stubEnv("ELEVENLABS_VOICE_ID", "configured-voice");
    vi.stubEnv("OPENAI_API_KEY", "configured-openai-key");
    mocks.isRequestAuthorized.mockReturnValue(true);
    mocks.getAuthenticatedUser.mockResolvedValue({ id: "user-a" });
    vi.spyOn(console, "error").mockImplementation(() => undefined);
  });
  afterEach(() => { vi.useRealTimers(); vi.unstubAllEnvs(); vi.restoreAllMocks(); vi.unstubAllGlobals(); });

  it("records one ElevenLabs operation when primary speech succeeds", async () => {
    const primary = reservation();
    mocks.reserveUsage.mockResolvedValue(primary);
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response(new Uint8Array([1, 2, 3]))));

    const response = await POST(request());

    expect(response.status).toBe(200);
    expect(response.headers.get("X-Voice-Provider")).toBe("elevenlabs");
    expect(mocks.reserveUsage).toHaveBeenCalledOnce();
    expect(primary.complete).toHaveBeenCalledOnce();
    expect(primary.fail).not.toHaveBeenCalled();
    expect(mocks.openAiSpeech).not.toHaveBeenCalled();
  });

  it("records one failed ElevenLabs operation and exactly one OpenAI fallback", async () => {
    const primary = reservation(); const fallback = reservation();
    mocks.reserveUsage.mockResolvedValueOnce(primary).mockResolvedValueOnce(fallback);
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response(null, { status: 401 })));
    mocks.openAiSpeech.mockResolvedValue({ arrayBuffer: vi.fn().mockResolvedValue(new ArrayBuffer(3)) });

    const response = await POST(request());

    expect(response.status).toBe(200);
    expect(response.headers.get("X-Voice-Provider")).toBe("openai");
    expect(mocks.reserveUsage).toHaveBeenCalledTimes(2);
    expect(primary.fail).toHaveBeenCalledOnce();
    expect(fallback.complete).toHaveBeenCalledOnce();
    expect(fallback.fail).not.toHaveBeenCalled();
    expect(mocks.openAiSpeech).toHaveBeenCalledOnce();
    expect(console.error).toHaveBeenCalledWith("ElevenLabs voice failed; using fallback:",
      { classification: "authentication", status: 401 });
  });

  it("does not reserve or invoke fallback after client cancellation", async () => {
    const primary = reservation();
    mocks.reserveUsage.mockResolvedValue(primary);
    vi.stubGlobal("fetch", vi.fn((_url, init: RequestInit) => new Promise<Response>((_resolve, reject) => {
      (init.signal as AbortSignal).addEventListener("abort", () => reject(new DOMException("cancelled", "AbortError")));
    })));
    const controller = new AbortController();
    const responsePromise = POST(request(controller.signal));
    await vi.waitFor(() => expect(fetch).toHaveBeenCalledOnce());

    controller.abort();
    const response = await responsePromise;

    expect(response.status).toBe(499);
    expect(mocks.reserveUsage).toHaveBeenCalledOnce();
    expect(primary.fail).toHaveBeenCalledOnce();
    expect(mocks.openAiSpeech).not.toHaveBeenCalled();
  });

  it("times out ElevenLabs once and performs one OpenAI fallback", async () => {
    vi.useFakeTimers();
    const primary = reservation(); const fallback = reservation();
    mocks.reserveUsage.mockResolvedValueOnce(primary).mockResolvedValueOnce(fallback);
    vi.stubGlobal("fetch", vi.fn((_url, init: RequestInit) => new Promise<Response>((_resolve, reject) => {
      (init.signal as AbortSignal).addEventListener("abort", () => reject((init.signal as AbortSignal).reason));
    })));
    mocks.openAiSpeech.mockResolvedValue({ arrayBuffer: vi.fn().mockResolvedValue(new ArrayBuffer(3)) });
    const responsePromise = POST(request());
    await vi.waitFor(() => expect(fetch).toHaveBeenCalledOnce());

    await vi.advanceTimersByTimeAsync(15_000);
    const response = await responsePromise;

    expect(response.status).toBe(200);
    expect(primary.fail).toHaveBeenCalledOnce();
    expect(fallback.complete).toHaveBeenCalledOnce();
    expect(mocks.openAiSpeech).toHaveBeenCalledOnce();
    expect(console.error).toHaveBeenCalledWith("ElevenLabs voice failed; using fallback:",
      { classification: "timeout", status: null });
  });
});
