import { NextResponse } from "next/server";

import { isRequestAuthorized } from "@/core/auth/access";
import { createOpenAIProvider } from "@/services/providers";
import { reasonAboutRequest } from "@/core/reasoning";

export const runtime = "nodejs";

interface ChatRequestBody {
  prompt?: unknown;
  instructions?: unknown;
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
      },
    );
  }

  try {
    const body = (await request.json()) as ChatRequestBody;

    if (
      typeof body.prompt !== "string" ||
      !body.prompt.trim()
    ) {
      return NextResponse.json(
        {
          error: "A non-empty prompt is required.",
          code: "IAURA_PROMPT_REQUIRED",
        },
        {
          status: 400,
          headers: {
            "Cache-Control": "no-store",
          },
        },
      );
    }

    const instructions =
  typeof body.instructions === "string" &&
  body.instructions.trim()
    ? body.instructions.trim()
    : undefined;

const reasoning = reasonAboutRequest(body.prompt.trim(), {
  context: instructions,
});

    const provider = createOpenAIProvider();

    const result = await provider.generate({
  prompt: body.prompt.trim(),
  instructions: [
    instructions,
    reasoning.instructions,
  ]
    .filter(Boolean)
    .join("\n\n"),
});

    return NextResponse.json(result, {
      headers: {
        "Cache-Control": "no-store",
      },
    });
  } catch (error) {
  console.error("========== OPENAI ERROR ==========");
  console.error(error);
  console.error(
    JSON.stringify(
      error,
      Object.getOwnPropertyNames(error),
      2
    )
  );
  console.error("================================");

    return NextResponse.json(
      {
        error:
          "IAURA could not generate a response at this time.",
        code: "IAURA_PROVIDER_ERROR",
      },
      {
        status: 502,
        headers: {
          "Cache-Control": "no-store",
        },
      },
    );
  }
}