import OpenAI from "openai";
import { NextResponse } from "next/server";

export const runtime = "nodejs";

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

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
    const message = await response.text();

    throw new Error(
      `ElevenLabs failed (${response.status}): ${message}`
    );
  }

  return response.arrayBuffer();
}

async function generateOpenAIFallback(
  text: string
): Promise<ArrayBuffer> {
  const speech = await openai.audio.speech.create({
    model: "gpt-4o-mini-tts-2025-12-15",
    voice: "marin",
    input: text,
    instructions:
      "Speak naturally with a warm, calm and clear multilingual female voice.",
    response_format: "mp3",
  });

  return speech.arrayBuffer();
}

export async function POST(request: Request) {
  try {
    const { text } = (await request.json()) as {
      text?: string;
    };

    const normalizedText = text?.trim();

    if (!normalizedText) {
      return NextResponse.json(
        { error: "Voice text is required." },
        { status: 400 }
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
        error
      );

      provider = "openai";
      audioBuffer =
        await generateOpenAIFallback(safeText);
    }

    return new Response(audioBuffer, {
      headers: {
        "Content-Type": "audio/mpeg",
        "Cache-Control": "no-store",
        "X-Voice-Provider": provider,
      },
    });
  } catch (error) {
    console.error(
      "IAURA voice generation failed:",
      error
    );

    return NextResponse.json(
      {
        error:
          "Could not generate IAURA voice.",
      },
      { status: 500 }
    );
  }
}