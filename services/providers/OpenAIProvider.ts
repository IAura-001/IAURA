import OpenAI from "openai";
import type { ResponseInput } from "openai/resources/responses/responses";

import {
  IAURA_RESPONSE_SCHEMA,
  parseAuraAssistantPlan,
} from "@/core/actions";
import type { CognitiveRequest } from "@/core/brain";
import type {
  AIProvider,
  AIResponse,
} from "@/core/providers";
import {
  assertValidCognitiveRequest,
} from "@/core/validator/ResponseValidator";
import { parseOpenAIResponseUsage } from "@/core/aiUsage/provider";
import type { ProviderUsage } from "@/core/aiUsage/types";

interface OpenAIProviderConfig {
  apiKey: string;
  model: string;
  onUsage?: (usage: ProviderUsage) => void | Promise<void>;
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
  private readonly onUsage?: OpenAIProviderConfig["onUsage"];

  constructor({
    apiKey,
    model,
    onUsage,
  }: OpenAIProviderConfig) {
    if (!apiKey.trim()) {
      throw new Error("OPENAI_API_KEY is required.");
    }

    if (!model.trim()) {
      throw new Error("OPENAI_MODEL is required.");
    }

    this.client = new OpenAI({
      apiKey,
      maxRetries: 0,
    });

    this.model = model;
    this.onUsage = onUsage;
  }

  async generate(
    cognitiveRequest: CognitiveRequest,
  ): Promise<AIResponse> {
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

      if (this.onUsage) {
        await Promise.resolve(this.onUsage(parseOpenAIResponseUsage(response, this.model)))
          .catch((error) => console.error("AI usage accounting failed:", error instanceof Error ? error.message : "unknown"));
      }

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

export function createOpenAIProvider(options: { onUsage?: OpenAIProviderConfig["onUsage"] } = {}): OpenAIProvider {
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
    onUsage: options.onUsage,
  });
}
