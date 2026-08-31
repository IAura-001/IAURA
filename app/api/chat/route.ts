import { NextResponse } from "next/server";

import { isRequestAuthorized } from "@/core/auth/access";
import {
  authenticationRequiredResponse,
  getAuthenticatedUser,
} from "@/core/auth/session";
import {
  iauraBrain,
  type CognitiveRequest,
} from "@/core/brain";
import {
  assertValidCognitiveRequest,
  BrainValidationError,
} from "@/core/validator/ResponseValidator";
import { createOpenAIProvider } from "@/services/providers";
import { AiEntitlementError, AiSafetyLimitError } from "@/core/aiUsage/types";
import { aiEntitlementResponse, aiLimitResponse, reserveAiUsage } from "@/core/aiUsage/server";

export const runtime = "nodejs";

interface ChatRequestBody {
  originalUserMessage?: unknown;
  structuredContext?: unknown;
  compiledPrompt?: unknown;
  projectId?: unknown;
  prompt?: unknown;
  instructions?: unknown;
}

function noStoreHeaders(): Record<string, string> {
  return {
    "Cache-Control": "no-store",
  };
}

function isRecord(
  value: unknown,
): value is Record<string, unknown> {
  return (
    typeof value === "object" &&
    value !== null &&
    !Array.isArray(value)
  );
}

function hasCognitiveRequestField(
  body: ChatRequestBody,
): boolean {
  return (
    "originalUserMessage" in body ||
    "structuredContext" in body ||
    "compiledPrompt" in body
  );
}

function readCognitiveRequest(
  body: ChatRequestBody,
): CognitiveRequest {
  const cognitiveRequest = {
    originalUserMessage: body.originalUserMessage,
    structuredContext: body.structuredContext,
    compiledPrompt: body.compiledPrompt,
    projectId: body.projectId,
  };

  assertValidCognitiveRequest(cognitiveRequest);

  return cognitiveRequest;
}

function invalidRequest(
  error: string,
  code: string,
): NextResponse {
  return NextResponse.json(
    { error, code },
    {
      status: 400,
      headers: noStoreHeaders(),
    },
  );
}

function adaptLegacyRequest(
  body: ChatRequestBody,
): CognitiveRequest | null {
  if (
    typeof body.prompt !== "string" ||
    !body.prompt.trim()
  ) {
    return null;
  }

  const instructions =
    typeof body.instructions === "string" &&
    body.instructions.trim()
      ? body.instructions.trim()
      : undefined;

  const result = iauraBrain.analyze({
    message: body.prompt.trim(),
    userContext: instructions,
  });

  return {
    originalUserMessage: result.originalUserMessage,
    structuredContext: result.structuredContext,
    compiledPrompt: result.compiledPrompt,
  };
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
        headers: noStoreHeaders(),
      },
    );
  }

  if (!(await getAuthenticatedUser(request))) return authenticationRequiredResponse();

  let body: ChatRequestBody;

  try {
    const candidate = (await request.json()) as unknown;

    if (!isRecord(candidate)) {
      return invalidRequest(
        "The chat request body must be a JSON object.",
        "IAURA_INVALID_REQUEST",
      );
    }

    body = candidate;
  } catch {
    return invalidRequest(
      "The chat request body contains invalid JSON.",
      "IAURA_INVALID_REQUEST",
    );
  }

  let cognitiveRequest: CognitiveRequest;

  try {
    if (hasCognitiveRequestField(body)) {
      cognitiveRequest = readCognitiveRequest(body);
    } else {
      const legacyRequest = adaptLegacyRequest(body);

      if (!legacyRequest) {
        return invalidRequest(
          "A non-empty prompt is required.",
          "IAURA_PROMPT_REQUIRED",
        );
      }

      cognitiveRequest = legacyRequest;
    }
  } catch (error) {
    if (error instanceof BrainValidationError) {
      return invalidRequest(
        error.message,
        "IAURA_COGNITIVE_REQUEST_INVALID",
      );
    }

    console.error(
      "IAURA cognitive request preparation failed.",
      error instanceof Error
        ? error.message.slice(0, 500)
        : "Unknown cognitive preparation failure.",
    );

    return NextResponse.json(
      {
        error:
          "IAURA could not prepare this request at this time.",
        code: "IAURA_COGNITIVE_PREPARATION_ERROR",
      },
      {
        status: 502,
        headers: noStoreHeaders(),
      },
    );
  }

  let usageReservation;
  try {
    usageReservation = cognitiveRequest.projectId
      ? await reserveAiUsage(request, "chat", undefined, cognitiveRequest.projectId)
      : await reserveAiUsage(request, "chat");
  } catch (error) {
    if (error instanceof AiSafetyLimitError) return aiLimitResponse(error);
    if (error instanceof AiEntitlementError) return aiEntitlementResponse(error);
    return NextResponse.json({ error: "AI usage controls are temporarily unavailable.", code: "VAEORA_AI_GUARD_UNAVAILABLE" },
      { status: 503, headers: noStoreHeaders() });
  }

  try {
    const provider = createOpenAIProvider({ onUsage: (usage) => usageReservation.complete(usage) });
    const result = await provider.generate(cognitiveRequest);

    return NextResponse.json(result, {
      headers: noStoreHeaders(),
    });
    } catch (error: unknown) {
    await usageReservation.fail("openai", process.env.OPENAI_MODEL ?? "unknown");
    const details =
      typeof error === "object" && error !== null
        ? error as Record<string, unknown>
        : {};

    const summary = {
      name:
        typeof details.name === "string"
          ? details.name.slice(0, 200)
          : undefined,
      status:
        typeof details.status === "number"
          ? details.status
          : undefined,
      code:
        typeof details.code === "string"
          ? details.code.slice(0, 200)
          : undefined,
      type:
        typeof details.type === "string"
          ? details.type.slice(0, 200)
          : undefined,
      requestId:
        typeof details.request_id === "string"
          ? details.request_id.slice(0, 200)
          : undefined,
    };

    console.error(
      `IAURA chat provider failed: ${JSON.stringify(summary)}`
    );

    return NextResponse.json(
      {
        error:
          "IAURA could not generate a response at this time.",
        code: "IAURA_PROVIDER_ERROR",
      },
      {
        status: 502,
        headers: noStoreHeaders(),
      },
    );
  }
}
