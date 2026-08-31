import OpenAI from "openai";
import { NextResponse } from "next/server";
import { isRequestAuthorized } from "@/core/auth/access";
import {
  authenticationRequiredResponse,
  getAuthenticatedUser,
} from "@/core/auth/session";
import {
  getLanguageDefinition,
  normalizeLocale,
  type SupportedLocale,
} from "@/core/i18n/languages";
import {
  auraVoiceModes,
  normalizeAuraVoiceMode,
  type AuraVoiceMode,
} from "@/core/voice/providers/voiceModes";
import { AiEntitlementError, AiSafetyLimitError } from "@/core/aiUsage/types";
import { aiEntitlementResponse, aiLimitResponse, reserveAiUsage } from "@/core/aiUsage/server";
import { unknownProviderUsage } from "@/core/aiUsage/provider";
import { isAbortError } from "@/utils/abort";

export const runtime = "nodejs";
const ELEVENLABS_TIMEOUT_MS = 15_000;

type ElevenLabsFailureClass =
  | "configuration"
  | "authentication"
  | "voice_not_found"
  | "invalid_request"
  | "rate_limit"
  | "provider"
  | "timeout"
  | "network";

class ElevenLabsRequestError extends Error {
  constructor(
    public readonly classification: ElevenLabsFailureClass,
    public readonly status: number | null = null,
  ) {
    super(`ElevenLabs request failed (${classification}).`);
    this.name = "ElevenLabsRequestError";
  }
}

function classifyElevenLabsStatus(status: number): ElevenLabsFailureClass {
  if (status === 401 || status === 403) return "authentication";
  if (status === 404) return "voice_not_found";
  if (status === 400 || status === 422) return "invalid_request";
  if (status === 429) return "rate_limit";
  return "provider";
}

async function generateElevenLabsVoice(
  text: string,
  previousText: string,
  nextText: string,
  requestSignal: AbortSignal,
): Promise<ArrayBuffer> {
  const apiKey = process.env.ELEVENLABS_API_KEY?.trim();
  const voiceId = process.env.ELEVENLABS_VOICE_ID?.trim();

  if (!apiKey || !voiceId) {
    throw new ElevenLabsRequestError("configuration");
  }

  const controller = new AbortController();
  const abortFromRequest = () => controller.abort(requestSignal.reason);
  requestSignal.addEventListener("abort", abortFromRequest, { once: true });
  const timeout = setTimeout(() => {
    controller.abort(new DOMException("ElevenLabs timed out.", "TimeoutError"));
  }, ELEVENLABS_TIMEOUT_MS);

  try {
    const response = await fetch(
      `https://api.elevenlabs.io/v1/text-to-speech/${encodeURIComponent(voiceId)}/stream?output_format=mp3_44100_128`,
      {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "xi-api-key": apiKey,
      },
      body: JSON.stringify({
        text,
        model_id:
          process.env.ELEVENLABS_MODEL_ID ??
          "eleven_flash_v2_5",
        previous_text:
          previousText || undefined,
        next_text: nextText || undefined,
        voice_settings: {
          stability: 0.5,
          similarity_boost: 0.75,
          style: 0,
          use_speaker_boost: true,
          speed: 0.92,
        },
      }),
      cache: "no-store",
      signal: controller.signal,
      },
    );

    if (!response.ok) {
      throw new ElevenLabsRequestError(
        classifyElevenLabsStatus(response.status),
        response.status,
      );
    }

    return response.arrayBuffer();
  } catch (error) {
    if (requestSignal.aborted) throw requestSignal.reason ?? error;
    if (controller.signal.reason instanceof DOMException &&
        controller.signal.reason.name === "TimeoutError") {
      throw new ElevenLabsRequestError("timeout");
    }
    if (error instanceof ElevenLabsRequestError) throw error;
    throw new ElevenLabsRequestError("network");
  } finally {
    clearTimeout(timeout);
    requestSignal.removeEventListener("abort", abortFromRequest);
  }
}

async function generateOpenAIFallback(
  text: string,
  language: SupportedLocale,
  mode: AuraVoiceMode,
  signal: AbortSignal,
): Promise<ArrayBuffer> {
  const apiKey = process.env.OPENAI_API_KEY;

  if (!apiKey) {
    throw new Error(
      "OpenAI fallback configuration is missing."
    );
  }

  const openai = new OpenAI({
    apiKey,
    maxRetries: 0,
  });
  const languageDefinition =
    getLanguageDefinition(language);
  const voiceStyle = auraVoiceModes[mode];

  const speech = await openai.audio.speech.create({
    model: "gpt-4o-mini-tts-2025-12-15",
    voice: "marin",
    input: text.slice(0, 4096),
    instructions: [
      `Speak in ${languageDefinition.englishName}.`,
      "Use a natural, warm, calm and clear multilingual female voice.",
      `The delivery should feel ${voiceStyle.emotion}, human and emotionally present.`,
      "Avoid robotic cadence, exaggerated narration and artificial pauses.",
    ].join(" "),
    response_format: "mp3",
  }, { signal });

  return speech.arrayBuffer();
}

export async function POST(request: Request) {
  if (!isRequestAuthorized(request)) {
    return NextResponse.json(
      {
        error: "IAURA private access required.",
        code: "IAURA_ACCESS_REQUIRED",
      },
      {
        status: 401,
        headers: {
          "Cache-Control": "no-store",
        },
      }
    );
  }

  if (!(await getAuthenticatedUser(request))) return authenticationRequiredResponse();

  try {
    const {
      text,
      language,
      mode,
      previousText,
      nextText,
    } = (await request.json()) as {
      text?: unknown;
      language?: unknown;
      mode?: unknown;
      previousText?: unknown;
      nextText?: unknown;
    };

    const normalizedText =
      typeof text === "string"
        ? text.trim()
        : "";
    const normalizedLanguage =
      normalizeLocale(language);
    const normalizedMode =
      normalizeAuraVoiceMode(mode);
    const normalizedPreviousText =
      typeof previousText === "string"
        ? previousText.trim().slice(-500)
        : "";
    const normalizedNextText =
      typeof nextText === "string"
        ? nextText.trim().slice(0, 500)
        : "";

    if (!normalizedText) {
      return NextResponse.json(
        {
          error: "Voice text is required.",
        },
        {
          status: 400,
        }
      );
    }

    const safeText = normalizedText.slice(0, 5000);

    let audioBuffer: ArrayBuffer;
    let provider = "elevenlabs";

    let voiceReservation;
    try { voiceReservation = await reserveAiUsage(request, "speech"); }
    catch (error) { if (error instanceof AiSafetyLimitError) return aiLimitResponse(error);
      if (error instanceof AiEntitlementError) return aiEntitlementResponse(error); throw error; }
    try {
      audioBuffer = await generateElevenLabsVoice(
          safeText,
          normalizedPreviousText,
          normalizedNextText,
          request.signal,
        );
      await voiceReservation.complete(unknownProviderUsage(
        "elevenlabs", process.env.ELEVENLABS_MODEL_ID ?? "eleven_flash_v2_5",
      ));
    } catch (error) {
      await voiceReservation.fail("elevenlabs", process.env.ELEVENLABS_MODEL_ID ?? "eleven_flash_v2_5");
      if (request.signal.aborted || isAbortError(error)) throw error;
      const diagnostic = error instanceof ElevenLabsRequestError
        ? { classification: error.classification, status: error.status }
        : { classification: "unknown", status: null };
      console.error(
        "ElevenLabs voice failed; using fallback:",
        diagnostic,
      );

      provider = "openai";
      let fallbackReservation;
      try { fallbackReservation = await reserveAiUsage(request, "speech", undefined, null, null, 0); }
      catch (limitError) { if (limitError instanceof AiSafetyLimitError) return aiLimitResponse(limitError);
        if (limitError instanceof AiEntitlementError) return aiEntitlementResponse(limitError); throw limitError; }
      try { audioBuffer = await generateOpenAIFallback(
          safeText,
          normalizedLanguage,
          normalizedMode,
          request.signal,
        );
        await fallbackReservation.complete(unknownProviderUsage("openai", "gpt-4o-mini-tts-2025-12-15"));
      } catch (fallbackError) {
        await fallbackReservation.fail("openai", "gpt-4o-mini-tts-2025-12-15");
        throw fallbackError;
      }
    }

    return new Response(audioBuffer, {
      headers: {
        "Content-Type": "audio/mpeg",
        "Cache-Control": "no-store",
        "X-Voice-Provider": provider,
        "X-Voice-Language":
          normalizedLanguage,
      },
    });
  } catch (error) {
    if (request.signal.aborted || isAbortError(error)) {
      return new Response(null, { status: 499 });
    }
    console.error(
      "IAURA voice generation failed:",
      error instanceof Error
        ? error.name
        : "UnknownError"
    );

    return NextResponse.json(
      {
        error:
          "Could not generate IAURA voice.",
      },
      {
        status: 500,
      }
    );
  }
}
