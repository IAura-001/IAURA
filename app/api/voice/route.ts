import OpenAI from "openai";
import { NextResponse } from "next/server";
import { isRequestAuthorized } from "@/core/auth/access";
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

export const runtime = "nodejs";

async function generateElevenLabsVoice(
  text: string
): Promise<ArrayBuffer> {
  const apiKey = process.env.ELEVENLABS_API_KEY;
  const voiceId = process.env.ELEVENLABS_VOICE_ID;

  if (!apiKey || !voiceId) {
    throw new Error(
      "ElevenLabs configuration is missing."
    );
  }

  const response = await fetch(
    `https://api.elevenlabs.io/v1/text-to-speech/${voiceId}?output_format=mp3_44100_128`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "xi-api-key": apiKey,
      },
      body: JSON.stringify({
        text,
        model_id: "eleven_multilingual_v2",
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

  try {
    const {
      text,
      language,
      mode,
    } = (await request.json()) as {
      text?: unknown;
      language?: unknown;
      mode?: unknown;
    };

    const normalizedText =
      typeof text === "string"
        ? text.trim()
        : "";
    const normalizedLanguage =
      normalizeLocale(language);
    const normalizedMode =
      normalizeAuraVoiceMode(mode);

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

    try {
      audioBuffer =
        await generateElevenLabsVoice(safeText);
    } catch (error) {
      console.error(
        "ElevenLabs voice failed; using fallback:",
        error instanceof Error
          ? error.name
          : "UnknownError"
      );

      provider = "openai";
      audioBuffer =
        await generateOpenAIFallback(
          safeText,
          normalizedLanguage,
          normalizedMode
        );
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
