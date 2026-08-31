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
  createCreativeRequestId,
  readCreativeJson,
} from "@/core/creative/http";
import {
  acquireCreativeGenerationLease,
  assertCreativeGenerationDeploymentReady,
  createCreativeGenerationScope,
  createCreativeRequestFingerprint,
} from "@/core/creative/limits";
import type {
  CreativeApiErrorResponse,
  CreativeCopyApiResponse,
} from "@/core/creative/types";
import {
  validateCreativeCopyRequest,
} from "@/core/creative/validation";
import {
  createOpenAICreativeProvider,
} from "@/services/providers/OpenAICreativeProvider";
import { AiEntitlementError, AiSafetyLimitError } from "@/core/aiUsage/types";
import { aiEntitlementResponse, aiLimitResponse, reserveAiUsage } from "@/core/aiUsage/server";

export const runtime = "nodejs";
export const maxDuration = 120;

const responseHeaders = (requestId: string) => ({
  "Cache-Control": "no-store",
  "X-Content-Type-Options": "nosniff",
  "X-Request-Id": requestId,
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
    const validated = validateCreativeCopyRequest(body);

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
    const lease = await acquireCreativeGenerationLease("copy", 1, {
      scope,
      fingerprint: createCreativeRequestFingerprint(
        "copy",
        scope,
        validated.data,
      ),
      signal: request.signal,
    });

    try {
      let reservation;
      try { reservation = await reserveAiUsage(request, "creative_copy", requestId, validated.data.projectId); }
      catch (error) { if (error instanceof AiSafetyLimitError) return aiLimitResponse(error);
        if (error instanceof AiEntitlementError) return aiEntitlementResponse(error); throw error; }
      let result;
      try {
        const provider = createOpenAICreativeProvider({ onUsage: (usage) => reservation.complete(usage) });
        result = await provider.generateCopy(validated.data, request.signal);
      } catch (error) {
        await reservation.fail("openai", process.env.OPENAI_CREATIVE_MODEL ?? "gpt-5.6-terra");
        throw error;
      }

      return NextResponse.json<CreativeCopyApiResponse>(
        {
          requestId,
          result,
        },
        {
          headers: responseHeaders(requestId),
        },
      );
    } finally {
      await lease.release();
    }
  } catch (error) {
    const publicError = toCreativePublicError(error, requestId);

    if (isCreativeCancellation(error)) {
      if (process.env.NODE_ENV !== "production") {
        console.info("VAEORA creative copy request cancelled:", { requestId });
      }
    } else {
      console.error("VAEORA creative copy request failed:", {
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
