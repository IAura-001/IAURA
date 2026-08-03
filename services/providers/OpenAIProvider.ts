import OpenAI from "openai";
import type { ResponseInput } from "openai/resources/responses/responses";

import {
  IAURA_RESPONSE_SCHEMA,
  parseAuraAssistantPlan,
} from "@/core/actions";
import {
  iauraBrain,
  type CognitiveRequest,
} from "@/core/brain";
import type {
  AIProvider,
  AIRequest,
  AIResponse,
  LegacyAIRequest,
} from "@/core/providers";
import {
  assertValidCognitiveRequest,
} from "@/core/validator/ResponseValidator";

interface OpenAIProviderConfig {
  apiKey: string;
  model: string;
}

function isCognitiveRequest(
  request: AIRequest,
): request is CognitiveRequest {
  return "originalUserMessage" in request;
}

function adaptLegacyRequest(
  request: LegacyAIRequest,
): CognitiveRequest {
  const result = iauraBrain.analyze({
    message: request.prompt,
    userContext: request.instructions,
  });

  return {
    originalUserMessage: result.originalUserMessage,
    structuredContext: result.structuredContext,
    compiledPrompt: result.compiledPrompt,
  };
}

function cleanErrorField(
  value: unknown,
): string | number | undefined {
  if (typeof value === "number") {
    return value;
  }

  if (typeof value !== "string") {
    return undefined;
  }

  return value.slice(0, 500);
}

function providerErrorSummary(
  error: unknown,
): Record<string, string | number | undefined> {
  if (typeof error !== "object" || error === null) {
    return {
      message: cleanErrorField(error),
    };
  }

  const candidate = error as Record<string, unknown>;

  return {
    name: cleanErrorField(candidate.name),
    message: cleanErrorField(candidate.message),
    status: cleanErrorField(candidate.status),
    code: cleanErrorField(candidate.code),
    type: cleanErrorField(candidate.type),
  };
}

function buildResponseInput(
  request: CognitiveRequest,
): ResponseInput {
  const {
    conversationHistory,
    ...structuredContext
  } = request.structuredContext;

  return [
    {
      role: "user",
      content: JSON.stringify(structuredContext),
    },
    ...conversationHistory.map((message) => ({
      role: message.role,
      content: message.content,
    })),
    {
      role: "user",
      content: request.originalUserMessage,
    },
  ];
}

export class OpenAIProvider implements AIProvider {
  readonly name = "openai";

  private readonly client: OpenAI;
  private readonly model: string;

  constructor({
    apiKey,
    model,
  }: OpenAIProviderConfig) {
    if (!apiKey.trim()) {
      throw new Error("OPENAI_API_KEY is required.");
    }

    if (!model.trim()) {
      throw new Error("OPENAI_MODEL is required.");
    }

    this.client = new OpenAI({
      apiKey,
    });

    this.model = model;
  }

  async generate(
    request: AIRequest,
  ): Promise<AIResponse> {
    const cognitiveRequest = isCognitiveRequest(request)
      ? request
      : adaptLegacyRequest(request);

    assertValidCognitiveRequest(cognitiveRequest);

    try {
      const response = await this.client.responses.create({
        model: this.model,
        instructions: cognitiveRequest.compiledPrompt,
        input: buildResponseInput(cognitiveRequest),
        text: {
          verbosity: "medium",
          format: {
            type: "json_schema",
            name: "iaura_action_plan",
            description:
              "IAURA response plus safe local actions.",
            strict: true,
            schema: IAURA_RESPONSE_SCHEMA,
          },
        },
      });

      const plan = parseAuraAssistantPlan(
        response.output_text,
      );

      return {
        ...plan,
        provider: this.name,
        model: this.model,
      };
    } catch (error: unknown) {
      console.error(
        "IAURA OpenAI generation failed.",
        providerErrorSummary(error),
      );

      throw error;
    }
  }
}

export function createOpenAIProvider(): OpenAIProvider {
  const apiKey = process.env.OPENAI_API_KEY;
  const model = process.env.OPENAI_MODEL;

  if (!apiKey) {
    throw new Error("OPENAI_API_KEY is missing.");
  }

  if (!model) {
    throw new Error("OPENAI_MODEL is missing.");
  }

  return new OpenAIProvider({
    apiKey,
    model,
  });
}
