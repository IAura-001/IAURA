import OpenAI, {
  APIConnectionTimeoutError,
  AuthenticationError,
  BadRequestError,
  PermissionDeniedError,
  RateLimitError,
  UnprocessableEntityError,
} from "openai";
import type {
  ImageGenerateParamsNonStreaming,
  ImagesResponse,
} from "openai/resources/images";
import type {
  Response as OpenAIResponse,
  ResponseCreateParamsNonStreaming,
} from "openai/resources/responses/responses";

import { CreativeProviderError } from "@/core/creative/errors";
import { decodeGeneratedImage } from "@/core/creative/imageBinary";
import {
  buildCreativeCopyInput,
  buildCreativeCopyInstructions,
  buildCreativeImagePrompt,
} from "@/core/creative/prompts";
import {
  imageModelSupportsUltra,
  resolveCreativeImagePreset,
} from "@/core/creative/presets";
import {
  CREATIVE_COPY_SCHEMA_NAMES,
  CREATIVE_COPY_SCHEMAS,
} from "@/core/creative/schemas";
import type {
  CreativeCopyDeliverable,
  CreativeCopyRequest,
  CreativeCopyResult,
  CreativeImageMimeType,
  CreativeImageRequest,
  CreativeImageResult,
} from "@/core/creative/types";
import {
  validateCreativeCopyContent,
} from "@/core/creative/validation";
import { isAbortError } from "@/utils/abort";
import { parseOpenAIResponseUsage, unknownProviderUsage } from "@/core/aiUsage/provider";
import type { ProviderUsage } from "@/core/aiUsage/types";

export const DEFAULT_CREATIVE_MODEL = "gpt-5.6-terra";
export const DEFAULT_IMAGE_MODEL = "gpt-image-2";
export const CREATIVE_COPY_TIMEOUT_MS = 90_000;
export const CREATIVE_IMAGE_TIMEOUT_MS = 150_000;

interface CreativeProviderRequestOptions {
  signal?: AbortSignal | null;
  timeout: number;
  maxRetries: number;
}

export interface OpenAICreativeTransport {
  createResponse(
    body: ResponseCreateParamsNonStreaming,
    options: CreativeProviderRequestOptions,
  ): Promise<Pick<OpenAIResponse, "id" | "model" | "output_text" | "usage">>;
  generateImage(
    body: ImageGenerateParamsNonStreaming,
    options: CreativeProviderRequestOptions,
  ): Promise<ImagesResponse>;
}

export interface OpenAICreativeProviderConfig {
  transport: OpenAICreativeTransport;
  creativeModel: string;
  imageModel: string;
  onUsage?: (usage: ProviderUsage) => void | Promise<void>;
}

function providerRequestId(error: unknown): string | undefined {
  if (
    typeof error === "object" &&
    error !== null &&
    "requestID" in error &&
    typeof error.requestID === "string"
  ) {
    return error.requestID;
  }

  return undefined;
}

function mapOpenAIError(error: unknown): CreativeProviderError {
  const requestId = providerRequestId(error);
  if (error instanceof Error) {
  console.error("[VAEORA_OPENAI_PROVIDER_ERROR]", {
    name: error.name,
    message: error.message,
    requestId,
    status:
      "status" in error && typeof error.status === "number"
        ? error.status
        : undefined,
    code:
      "code" in error && typeof error.code === "string"
        ? error.code
        : undefined,
    type:
      "type" in error && typeof error.type === "string"
        ? error.type
        : undefined,
  });
} else {
  console.error("[VAEORA_OPENAI_PROVIDER_ERROR]", {
    errorType: typeof error,
    requestId,
  });
}

  if (error instanceof APIConnectionTimeoutError) {
    return new CreativeProviderError("timeout", requestId);
  }

  if (error instanceof RateLimitError) {
    return new CreativeProviderError("rate_limit", requestId);
  }

  if (
    error instanceof BadRequestError ||
    error instanceof UnprocessableEntityError
  ) {
    return new CreativeProviderError("rejected", requestId);
  }

  if (
    error instanceof AuthenticationError ||
    error instanceof PermissionDeniedError
  ) {
    return new CreativeProviderError("configuration", requestId);
  }

  return new CreativeProviderError("unavailable", requestId);
}

function mimeTypeFor(
  format: "png" | "webp" | "jpeg",
): CreativeImageMimeType {
  if (format === "png") return "image/png";
  if (format === "jpeg") return "image/jpeg";
  return "image/webp";
}

export class OpenAICreativeProvider {
  private readonly transport: OpenAICreativeTransport;
  private readonly creativeModel: string;
  private readonly imageModel: string;
  private readonly onUsage?: OpenAICreativeProviderConfig["onUsage"];

  constructor({
    transport,
    creativeModel,
    imageModel,
    onUsage,
  }: OpenAICreativeProviderConfig) {
    if (!creativeModel.trim() || !imageModel.trim()) {
      throw new CreativeProviderError("configuration");
    }

    this.transport = transport;
    this.creativeModel = creativeModel.trim();
    this.imageModel = imageModel.trim();
    this.onUsage = onUsage;
  }

  async generateCopy<
    Deliverable extends CreativeCopyDeliverable,
  >(
    request: CreativeCopyRequest & {
      deliverable: Deliverable;
    },
    signal?: AbortSignal,
  ): Promise<CreativeCopyResult<Deliverable>> {
    try {
      const response = await this.transport.createResponse(
        {
          model: this.creativeModel,
          store: false,
          instructions: buildCreativeCopyInstructions(request),
          input: buildCreativeCopyInput(request),
          max_output_tokens: 5_000,
          text: {
            verbosity: "medium",
            format: {
              type: "json_schema",
              name: CREATIVE_COPY_SCHEMA_NAMES[request.deliverable],
              description:
                "A production-ready VAEORA creative deliverable.",
              strict: true,
              schema: CREATIVE_COPY_SCHEMAS[request.deliverable],
            },
          },
        },
        {
          signal,
          timeout: CREATIVE_COPY_TIMEOUT_MS,
          maxRetries: 0,
        },
      );
      if (this.onUsage) await Promise.resolve(this.onUsage(
        parseOpenAIResponseUsage(response, this.creativeModel),
      )).catch(() => undefined);
      const outputText = response.output_text.trim();

      if (!outputText) {
        throw new CreativeProviderError("empty_result");
      }

      let value: unknown;

      try {
        value = JSON.parse(outputText) as unknown;
      } catch {
        throw new CreativeProviderError("invalid_result");
      }

      const validated = validateCreativeCopyContent(
        request.deliverable,
        value,
      );

      if (!validated.success) {
        throw new CreativeProviderError("invalid_result");
      }

      return {
        deliverable: request.deliverable,
        content: validated.data,
        provider: "openai",
        model: this.creativeModel,
        createdAt: new Date().toISOString(),
      };
    } catch (error) {
      if (error instanceof CreativeProviderError) throw error;
      if (signal?.aborted || isAbortError(error)) throw error;
      throw mapOpenAIError(error);
    }
  }

  async generateImage(
    request: CreativeImageRequest,
    signal?: AbortSignal,
  ): Promise<CreativeImageResult> {
    const preset = resolveCreativeImagePreset(request);

    if (
      preset.experimental &&
      !imageModelSupportsUltra(this.imageModel)
    ) {
      throw new CreativeProviderError("unsupported_preset");
    }

    try {
      const response = await this.transport.generateImage(
        {
          model: this.imageModel,
          prompt: buildCreativeImagePrompt(request),
          n: 1,
          size: preset.size,
          quality: preset.quality,
          output_format: preset.outputFormat,
          background: preset.background,
          moderation: "auto",
          stream: false,
        },
        {
          signal,
          timeout: CREATIVE_IMAGE_TIMEOUT_MS,
          maxRetries: 0,
        },
      );
      const generated = response.data;
      if (this.onUsage) {
        const imageUsage = "usage" in response && response.usage
          ? { provider: "openai" as const, model: this.imageModel, providerRequestId: null,
              inputTokens: response.usage.input_tokens, outputTokens: response.usage.output_tokens,
              totalTokens: response.usage.total_tokens,
              cachedInputTokens: null,
              cacheWriteTokens: null,
              reasoningTokens: null, providerUsageAvailable: true }
          : unknownProviderUsage("openai", this.imageModel);
        await Promise.resolve(this.onUsage(imageUsage)).catch(() => undefined);
      }

      if (
        !generated ||
        generated.length !== 1 ||
        typeof generated[0]?.b64_json !== "string"
      ) {
        throw new CreativeProviderError("empty_result");
      }

      const image = decodeGeneratedImage(
        generated[0].b64_json,
        preset.outputFormat,
      );

      if (
        image.width !== preset.width ||
        image.height !== preset.height
      ) {
        throw new CreativeProviderError("invalid_result");
      }

      return {
        ...image,
        mimeType: mimeTypeFor(preset.outputFormat),
        experimental: preset.experimental,
        provider: "openai",
        model: this.imageModel,
        createdAt: new Date().toISOString(),
      };
    } catch (error) {
      if (error instanceof CreativeProviderError) throw error;
      if (signal?.aborted || isAbortError(error)) throw error;
      throw mapOpenAIError(error);
    }
  }
}

export function createOpenAICreativeProvider(options: {
  onUsage?: OpenAICreativeProviderConfig["onUsage"];
} = {}): OpenAICreativeProvider {
  if (typeof window !== "undefined") {
    throw new CreativeProviderError("configuration");
  }

  const apiKey = process.env.OPENAI_API_KEY?.trim();

  if (!apiKey) {
    throw new CreativeProviderError("configuration");
  }

  const creativeModel =
    process.env.OPENAI_CREATIVE_MODEL?.trim() ||
    DEFAULT_CREATIVE_MODEL;
  const imageModel =
    process.env.OPENAI_IMAGE_MODEL?.trim() ||
    DEFAULT_IMAGE_MODEL;
  const client = new OpenAI({
    apiKey,
    timeout: CREATIVE_IMAGE_TIMEOUT_MS,
    maxRetries: 0,
  });

  return new OpenAICreativeProvider({
    creativeModel,
    imageModel,
    onUsage: options.onUsage,
    transport: {
      createResponse: (body, options) =>
        client.responses.create(body, options),
      generateImage: (body, options) =>
        client.images.generate(body, options),
    },
  });
}
