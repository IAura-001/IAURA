import OpenAI from "openai";

import {
  IAURA_RESPONSE_SCHEMA,
  parseAuraAssistantPlan,
} from "@/core/actions";
import type {
  AIProvider,
  AIRequest,
  AIResponse,
} from "@/core/providers";

interface OpenAIProviderConfig {
  apiKey: string;
  model: string;
}

export class OpenAIProvider
  implements AIProvider
{
  readonly name = "openai";

  private readonly client: OpenAI;
  private readonly model: string;

  constructor({
    apiKey,
    model,
  }: OpenAIProviderConfig) {
    if (!apiKey.trim()) {
      throw new Error(
        "OPENAI_API_KEY is required."
      );
    }

    if (!model.trim()) {
      throw new Error(
        "OPENAI_MODEL is required."
      );
    }

    this.client = new OpenAI({
      apiKey,
    });

    this.model = model;
  }

  async generate(
    request: AIRequest
  ): Promise<AIResponse> {
    const response =
      await this.client.responses.create({
        model: this.model,
        instructions:
          request.instructions,
        input: request.prompt,
        text: {
          verbosity: "medium",
          format: {
            type: "json_schema",
            name: "iaura_action_plan",
            description:
              "IAURA response plus safe local actions.",
            strict: true,
            schema:
              IAURA_RESPONSE_SCHEMA,
          },
        },
      });

    const plan = parseAuraAssistantPlan(
      response.output_text
    );

    return {
      ...plan,
      provider: this.name,
      model: this.model,
    };
  }
}

export function createOpenAIProvider(): OpenAIProvider {
  const apiKey =
    process.env.OPENAI_API_KEY;

  const model =
    process.env.OPENAI_MODEL;

  if (!apiKey) {
    throw new Error(
      "OPENAI_API_KEY is missing."
    );
  }

  if (!model) {
    throw new Error(
      "OPENAI_MODEL is missing."
    );
  }

  return new OpenAIProvider({
    apiKey,
    model,
  });
}
