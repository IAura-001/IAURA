import { NextResponse } from "next/server";

import {
  hasValidAccessConfiguration,
  isRequestAuthorized,
} from "@/core/auth/access";
import {
  authenticationRequiredResponse,
  getAuthenticatedUser,
} from "@/core/auth/session";
import {
  CreativeRequestError,
  describeCreativeFailure,
  isCreativeCancellation,
  toCreativePublicError,
} from "@/core/creative/errors";
import {
  assertCreativeSameOrigin,
  createCreativeAssetId,
  createCreativeRequestId,
  readCreativeJson,
} from "@/core/creative/http";
import {
  acquireCreativeGenerationLease,
  assertCreativeGenerationDeploymentReady,
  createCreativeGenerationScope,
  createCreativeRequestFingerprint,
  creativeImageCostUnits,
} from "@/core/creative/limits";
import {
  CREATIVE_IMAGE_RESPONSE_HEADERS,
  type CreativeApiErrorResponse,
} from "@/core/creative/types";
import {
  validateCreativeImageRequest,
} from "@/core/creative/validation";
import {
  createOpenAICreativeProvider,
} from "@/services/providers/OpenAICreativeProvider";
import { AiSafetyLimitError } from "@/core/aiUsage/types";
import { aiLimitResponse, reserveAiUsage } from "@/core/aiUsage/server";

export const runtime = "nodejs";
export const maxDuration = 180;

const responseHeaders = (requestId: string) => ({
  "Cache-Control": "no-store",
  "X-Content-Type-Options": "nosniff",
  [CREATIVE_IMAGE_RESPONSE_HEADERS.requestId]: requestId,
});

export async function POST(request: Request) {
  const requestId = createCreativeRequestId();

  if (!hasValidAccessConfiguration()) {
    return NextResponse.json<CreativeApiErrorResponse>(
      {
        error: "IAURA private access is not configured.",
        code: "IAURA_ACCESS_NOT_CONFIGURED",
        requestId,
      },
      {
        status: 503,
        headers: responseHeaders(requestId),
      },
    );
  }

  if (!isRequestAuthorized(request)) {
    return NextResponse.json<CreativeApiErrorResponse>(
      {
        error: "IAURA private access required.",
        code: "IAURA_ACCESS_REQUIRED",
        requestId,
      },
      {
        status: 401,
        headers: responseHeaders(requestId),
      },
    );
  }

  if (!(await getAuthenticatedUser(request))) return authenticationRequiredResponse();

  try {
    assertCreativeSameOrigin(request);
    assertCreativeGenerationDeploymentReady();

    const body = await readCreativeJson(request);
    const validated = validateCreativeImageRequest(body);

    if (!validated.success) {
      throw new CreativeRequestError(
        validated.error.code === "VAEORA_UNSUPPORTED_PRESET"
          ? 422
          : 400,
        validated.error.code,
        validated.error.message,
      );
    }

    const scope = createCreativeGenerationScope(request);
    const lease = await acquireCreativeGenerationLease(
      "image",
      creativeImageCostUnits(validated.data.tier),
      {
        scope,
        fingerprint: createCreativeRequestFingerprint(
          "image",
          scope,
          validated.data,
        ),
        signal: request.signal,
      },
    );

    try {
      let reservation;
      try { reservation = await reserveAiUsage(request, "creative_image", requestId); }
      catch (error) { if (error instanceof AiSafetyLimitError) return aiLimitResponse(error); throw error; }
      let result;
      try {
        const provider = createOpenAICreativeProvider({ onUsage: (usage) => reservation.complete(usage) });
        result = await provider.generateImage(validated.data, request.signal);
      } catch (error) {
        await reservation.fail("openai", process.env.OPENAI_IMAGE_MODEL ?? "gpt-image-2");
        throw error;
      }
      const assetId = createCreativeAssetId();

      return new Response(result.data, {
        headers: {
          ...responseHeaders(requestId),
          "Content-Type": result.mimeType,
          "Content-Length": String(result.byteLength),
          [CREATIVE_IMAGE_RESPONSE_HEADERS.assetId]: assetId,
          [CREATIVE_IMAGE_RESPONSE_HEADERS.width]: String(result.width),
          [CREATIVE_IMAGE_RESPONSE_HEADERS.height]: String(result.height),
          [CREATIVE_IMAGE_RESPONSE_HEADERS.experimental]: String(
            result.experimental,
          ),
          [CREATIVE_IMAGE_RESPONSE_HEADERS.model]: result.model,
          [CREATIVE_IMAGE_RESPONSE_HEADERS.createdAt]: result.createdAt,
        },
      });
    } finally {
      await lease.release();
    }
  } catch (error) {
    const publicError = toCreativePublicError(error, requestId);

    if (isCreativeCancellation(error)) {
      if (process.env.NODE_ENV !== "production") {
        console.info("VAEORA creative image request cancelled:", { requestId });
      }
    } else {
      console.error("VAEORA creative image request failed:", {
        requestId,
        ...describeCreativeFailure(error),
      });
    }

    return NextResponse.json(publicError.body, {
      status: publicError.status,
      headers: {
        ...responseHeaders(requestId),
        ...(publicError.retryAfter
          ? {
              "Retry-After": String(publicError.retryAfter),
            }
          : {}),
      },
    });
  }
}
