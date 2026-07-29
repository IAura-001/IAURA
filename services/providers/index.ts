export {
  OpenAIProvider,
  createOpenAIProvider,
} from "./OpenAIProvider";import { NextResponse } from "next/server";

import { createOpenAIProvider } from "@/services/providers";

interface ChatRequestBody {
  prompt?: unknown;
  instructions?: unknown;
}

export async function POST(
  request: Request
) {
  try {
    const body =
      (await request.json()) as ChatRequestBody;

    if (
      typeof body.prompt !== "string" ||
      !body.prompt.trim()
    ) {
      return NextResponse.json(
        {
          error:
            "A non-empty prompt is required.",
        },
        {
          status: 400,
        }
      );
    }

    const instructions =
      typeof body.instructions === "string"
        ? body.instructions.trim()
        : undefined;

    const provider =
      createOpenAIProvider();

    const result =
      await provider.generate({
        prompt: body.prompt.trim(),
        instructions,
      });

    return NextResponse.json(result);
  } catch (error) {
    console.error(
      "IAURA provider error:",
      error
    );

    return NextResponse.json(
      {
        error:
          "IAURA could not generate a response.",
      },
      {
        status: 500,
      }
    );
  }
}