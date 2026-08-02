import {
  type CreativeApiErrorResponse,
  type CreativeCopyApiResponse,
  type CreativeCopyDeliverable,
  type CreativeCopyRequest,
  type CreativeCopyResult,
  type CreativeImageRequest,
  type CreativeImageResponseMetadata,
} from "@/core/creative/types";
import { readCreativeImageResponseMetadata } from "@/core/creative/validation";

export interface CreativeImageClientResult {
  blob: Blob;
  metadata: CreativeImageResponseMetadata;
}

export class CreativeClientError extends Error {
  readonly status: number;
  readonly code?: CreativeApiErrorResponse["code"];
  readonly requestId?: string;
  readonly retryAfter?: number;

  constructor(
    message: string,
    details: {
      status: number;
      code?: CreativeApiErrorResponse["code"];
      requestId?: string;
      retryAfter?: number;
    },
  ) {
    super(message);
    this.name = "CreativeClientError";
    this.status = details.status;
    this.code = details.code;
    this.requestId = details.requestId;
    this.retryAfter = details.retryAfter;
  }
}

async function readApiError(response: Response): Promise<Error> {
  try {
    const body = (await response.json()) as Partial<CreativeApiErrorResponse>;
    const retryAfterValue = Number(response.headers.get("Retry-After"));
    return new CreativeClientError(
      typeof body.error === "string" && body.error.trim()
        ? body.error
        : "VAEORA could not complete this creative request.",
      {
        status: response.status,
        ...(body.code ? { code: body.code } : {}),
        ...(body.requestId ? { requestId: body.requestId } : {}),
        ...(Number.isFinite(retryAfterValue) && retryAfterValue > 0
          ? { retryAfter: retryAfterValue }
          : {}),
      },
    );
  } catch (error) {
    if (error instanceof Error && error.name === "AbortError") throw error;

    return new CreativeClientError(
      "VAEORA could not complete this creative request.",
      { status: response.status },
    );
  }
}

export async function generateCreativeCopy<
  Deliverable extends CreativeCopyDeliverable,
>(
  request: CreativeCopyRequest & { deliverable: Deliverable },
  signal?: AbortSignal,
): Promise<CreativeCopyResult<Deliverable>> {
  const response = await fetch("/api/creative/copy", {
    method: "POST",
    credentials: "same-origin",
    cache: "no-store",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(request),
    signal,
  });

  if (!response.ok) throw await readApiError(response);

  const body = (await response.json()) as CreativeCopyApiResponse<Deliverable>;
  if (!body.result?.content) {
    throw new Error("VAEORA returned an incomplete creative system.");
  }

  return body.result;
}

export async function generateCreativeImage(
  request: CreativeImageRequest,
  signal?: AbortSignal,
): Promise<CreativeImageClientResult> {
  const response = await fetch("/api/creative/image", {
    method: "POST",
    credentials: "same-origin",
    cache: "no-store",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(request),
    signal,
  });

  if (!response.ok) throw await readApiError(response);

  const parsedMetadata = readCreativeImageResponseMetadata(response);
  if (!parsedMetadata.success) {
    throw new Error("VAEORA returned invalid image metadata.");
  }
  const blob = await response.blob();

  if (blob.size === 0) {
    throw new Error("VAEORA returned an incomplete image asset.");
  }

  return {
    blob,
    metadata: parsedMetadata.data,
  };
}
