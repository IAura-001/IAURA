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
} from "@/core/i18n/languages";
import { AiSafetyLimitError } from "@/core/aiUsage/types";
import { aiLimitResponse, reserveAiUsage } from "@/core/aiUsage/server";
import { unknownProviderUsage } from "@/core/aiUsage/provider";

export const runtime = "nodejs";

const MAX_AUDIO_BYTES =
  15 * 1024 * 1024;

export async function POST(
  request: Request
) {
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
    const formData =
      await request.formData();
    const audio = formData.get("audio");
    const language = normalizeLocale(
      formData.get("language")
    );

    if (!(audio instanceof File)) {
      return NextResponse.json(
        {
          error: "Audio is required.",
        },
        {
          status: 400,
        }
      );
    }

    if (
      audio.size === 0 ||
      audio.size > MAX_AUDIO_BYTES
    ) {
      return NextResponse.json(
        {
          error:
            "Audio size is not supported.",
        },
        {
          status: 400,
        }
      );
    }

    const apiKey =
      process.env.OPENAI_API_KEY;

    if (!apiKey) {
      throw new Error(
        "Transcription configuration is missing."
      );
    }

    const openai = new OpenAI({
      apiKey,
      maxRetries: 0,
    });
    const languageDefinition =
      getLanguageDefinition(language);
    let reservation;
    try { reservation = await reserveAiUsage(request, "transcription"); }
    catch (error) { if (error instanceof AiSafetyLimitError) return aiLimitResponse(error); throw error; }
    let transcription;
    try { transcription = await openai.audio.transcriptions.create({
        file: audio,
        model: "gpt-4o-mini-transcribe",
        language: languageDefinition.code,
        response_format: "json",
        prompt:
          "IAURA, Aura, personal goals, habits, projects and missions.",
      }); } catch (error) { await reservation.fail("openai", "gpt-4o-mini-transcribe"); throw error; }
    const providerUsage = unknownProviderUsage("openai", "gpt-4o-mini-transcribe");
    if (transcription.usage?.type === "tokens") {
      providerUsage.inputTokens = transcription.usage.input_tokens;
      providerUsage.outputTokens = transcription.usage.output_tokens;
      providerUsage.totalTokens = transcription.usage.total_tokens;
      providerUsage.providerUsageAvailable = true;
    }
    await reservation.complete(providerUsage);
    const text = transcription.text.trim();

    if (!text) {
      return NextResponse.json(
        {
          error:
            "No speech was detected.",
        },
        {
          status: 422,
        }
      );
    }

    return NextResponse.json(
      {
        text,
        language,
      },
      {
        headers: {
          "Cache-Control": "no-store",
        },
      }
    );
    } catch (error: unknown) {
  console.error("=== IAURA TRANSCRIPTION ERROR ===");

  if (error instanceof Error) {
    console.error("Name:", error.name);
    console.error("Message:", error.message);
    console.error("Stack:", error.stack);
  } else {
    console.error("Unknown error:", error);
  }

  return NextResponse.json(
    {
      error: "Could not transcribe IAURA audio.",
    },
    {
      status: 500,
      headers: {
        "Cache-Control": "no-store",
      },
    }
  );
}
}
