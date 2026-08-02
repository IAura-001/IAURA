import { CreativeRequestError } from "./errors";
import { MAX_CREATIVE_JSON_BYTES } from "./validation";

export function createCreativeRequestId(): string {
  return globalThis.crypto.randomUUID();
}

export function createCreativeAssetId(): string {
  return `asset_${globalThis.crypto.randomUUID()}`;
}

const CREATIVE_ALLOWED_ORIGINS_ENV = "VAEORA_ALLOWED_ORIGINS";

export function normalizeCreativeOrigin(value: string): string | null {
  try {
    const url = new URL(value.trim());

    if (
      (url.protocol !== "http:" && url.protocol !== "https:") ||
      url.username ||
      url.password ||
      url.search ||
      url.hash ||
      (url.pathname !== "/" && url.pathname !== "")
    ) {
      return null;
    }

    return url.origin;
  } catch {
    return null;
  }
}

function configuredCreativeOrigins(): Set<string> {
  const configured = process.env[CREATIVE_ALLOWED_ORIGINS_ENV] ?? "";

  return new Set(
    configured
      .split(",")
      .map(normalizeCreativeOrigin)
      .filter((origin): origin is string => Boolean(origin)),
  );
}

function isDevelopmentLoopback(origin: string): boolean {
  if (process.env.NODE_ENV === "production") return false;

  const hostname = new URL(origin).hostname;
  return (
    hostname === "localhost" ||
    hostname === "127.0.0.1" ||
    hostname === "[::1]"
  );
}

export function assertCreativeSameOrigin(request: Request): void {
  const origin = request.headers.get("origin");

  if (!origin) return;

  const normalizedOrigin = normalizeCreativeOrigin(origin);
  const requestOrigin = normalizeCreativeOrigin(new URL(request.url).origin);

  if (!normalizedOrigin || !requestOrigin) {
    throw new CreativeRequestError(
      403,
      "VAEORA_ORIGIN_REJECTED",
      "The creative request origin is not allowed.",
    );
  }

  if (
    normalizedOrigin !== requestOrigin &&
    !configuredCreativeOrigins().has(normalizedOrigin) &&
    !isDevelopmentLoopback(normalizedOrigin)
  ) {
    throw new CreativeRequestError(
      403,
      "VAEORA_ORIGIN_REJECTED",
      "The creative request origin is not allowed.",
    );
  }
}

export async function readCreativeJson(
  request: Request,
  maximumBytes = MAX_CREATIVE_JSON_BYTES,
): Promise<unknown> {
  const contentType = request.headers
    .get("content-type")
    ?.split(";", 1)[0]
    .trim()
    .toLowerCase();

  if (contentType !== "application/json") {
    throw new CreativeRequestError(
      415,
      "VAEORA_UNSUPPORTED_MEDIA_TYPE",
      "Creative requests require application/json.",
    );
  }

  const declaredLength = Number(
    request.headers.get("content-length"),
  );

  if (
    Number.isFinite(declaredLength) &&
    declaredLength > maximumBytes
  ) {
    throw new CreativeRequestError(
      413,
      "VAEORA_PAYLOAD_TOO_LARGE",
      "The creative request is too large.",
    );
  }

  if (!request.body) {
    throw new CreativeRequestError(
      400,
      "VAEORA_INVALID_REQUEST",
      "The creative request body is invalid.",
    );
  }

  const reader = request.body.getReader();
  const chunks: Uint8Array[] = [];
  let totalBytes = 0;

  while (true) {
    const { done, value } = await reader.read();

    if (done) break;
    totalBytes += value.byteLength;

    if (totalBytes > maximumBytes) {
      await reader.cancel();
      throw new CreativeRequestError(
        413,
        "VAEORA_PAYLOAD_TOO_LARGE",
        "The creative request is too large.",
      );
    }

    chunks.push(value);
  }

  const bytes = new Uint8Array(totalBytes);
  let offset = 0;

  for (const chunk of chunks) {
    bytes.set(chunk, offset);
    offset += chunk.byteLength;
  }

  let text: string;

  try {
    text = new TextDecoder("utf-8", {
      fatal: true,
    }).decode(bytes);
  } catch {
    throw new CreativeRequestError(
      400,
      "VAEORA_INVALID_REQUEST",
      "The creative request body is invalid.",
    );
  }

  try {
    return JSON.parse(text) as unknown;
  } catch {
    throw new CreativeRequestError(
      400,
      "VAEORA_INVALID_REQUEST",
      "The creative request body contains invalid JSON.",
    );
  }
}
