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

  if (!(await getAuthenticatedUser())) return authenticationRequiredResponse();

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
      const provider = createOpenAICreativeProvider();
      const result = await provider.generateCopy(
        validated.data,
        request.signal,
      );

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
