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
import { AiSafetyLimitError } from "@/core/aiUsage/types";
import { aiLimitResponse, reserveAiUsage } from "@/core/aiUsage/server";
import { unknownProviderUsage } from "@/core/aiUsage/provider";

export const runtime = "nodejs";

async function generateElevenLabsVoice(
  text: string,
  previousText: string,
  nextText: string
): Promise<ArrayBuffer> {
  const apiKey = process.env.ELEVENLABS_API_KEY;
  const voiceId = process.env.ELEVENLABS_VOICE_ID;

  if (!apiKey || !voiceId) {
    throw new Error(
      "ElevenLabs configuration is missing."
    );
  }

  const response = await fetch(
    `https://api.elevenlabs.io/v1/text-to-speech/${voiceId}/stream?output_format=mp3_44100_128`,
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
    }
  );

  if (!response.ok) {
    throw new Error(
      `ElevenLabs failed with status ${response.status}.`
    );
  }

  return response.arrayBuffer();
}

async function generateOpenAIFallback(
  text: string,
  language: SupportedLocale,
  mode: AuraVoiceMode
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
  });

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
    catch (error) { if (error instanceof AiSafetyLimitError) return aiLimitResponse(error); throw error; }
    try {
      audioBuffer = await generateElevenLabsVoice(
          safeText,
          normalizedPreviousText,
          normalizedNextText
        );
      await voiceReservation.complete(unknownProviderUsage(
        "elevenlabs", process.env.ELEVENLABS_MODEL_ID ?? "eleven_flash_v2_5",
      ));
    } catch (error) {
      await voiceReservation.fail("elevenlabs", process.env.ELEVENLABS_MODEL_ID ?? "eleven_flash_v2_5");
      console.error(
        "ElevenLabs voice failed; using fallback:",
        error instanceof Error
          ? error.name
          : "UnknownError"
      );

      provider = "openai";
      let fallbackReservation;
      try { fallbackReservation = await reserveAiUsage(request, "speech"); }
      catch (limitError) { if (limitError instanceof AiSafetyLimitError) return aiLimitResponse(limitError); throw limitError; }
      try { audioBuffer = await generateOpenAIFallback(
          safeText,
          normalizedLanguage,
          normalizedMode
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
