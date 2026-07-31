import { NextResponse } from "next/server";

import { isRequestAuthorized } from "@/core/auth/access";
import { createOpenAIProvider } from "@/services/providers";

interface ChatRequestBody {
  prompt?: unknown;
  instructions?: unknown;
}

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
      typeof body.instructions === "string" &&
      body.instructions.trim()
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
      "IAURA provider request failed:",
      error instanceof Error
        ? error.name
        : "UnknownError"
    );

    return NextResponse.json(
      {
        error:
          "IAURA could not generate a response at this time.",
        code: "IAURA_PROVIDER_ERROR",
      },
      {
        status: 502,
      }
    );
  }
}
