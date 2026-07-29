import OpenAI from "openai";

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
      });

    const content =
      response.output_text.trim();

    if (!content) {
      throw new Error(
        "OpenAI returned an empty response."
      );
    }

    return {
      content,
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