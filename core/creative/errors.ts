import type {
  CreativeApiErrorCode,
  CreativeApiErrorResponse,
} from "./types";

export type CreativeProviderFailureKind =
  | "configuration"
  | "rate_limit"
  | "rejected"
  | "unsupported_preset"
  | "timeout"
  | "empty_result"
  | "invalid_result"
  | "unavailable";

export class CreativeProviderError extends Error {
  readonly kind: CreativeProviderFailureKind;
  readonly providerRequestId?: string;

  constructor(
    kind: CreativeProviderFailureKind,
    providerRequestId?: string,
  ) {
    super("Creative provider request failed.");
    this.name = "CreativeProviderError";
    this.kind = kind;
    this.providerRequestId = providerRequestId;
  }
}

export class CreativeRequestError extends Error {
  readonly status: number;
  readonly code: CreativeApiErrorCode;
  readonly publicMessage: string;
  readonly retryAfter?: number;

  constructor(
    status: number,
    code: CreativeApiErrorCode,
    publicMessage: string,
    retryAfter?: number,
  ) {
    super("Creative request failed validation.");
    this.name = "CreativeRequestError";
    this.status = status;
    this.code = code;
    this.publicMessage = publicMessage;
    this.retryAfter = retryAfter;
  }
}

export interface CreativePublicError {
  status: number;
  body: CreativeApiErrorResponse;
  retryAfter?: number;
}

const PROVIDER_ERROR_MAP: Record<
  CreativeProviderFailureKind,
  Omit<CreativePublicError, "body"> & {
    code: CreativeApiErrorCode;
    message: string;
  }
> = {
  configuration: {
    status: 503,
    code: "VAEORA_CREATIVE_NOT_CONFIGURED",
    message: "VAEORA creative generation is not configured.",
  },
  rate_limit: {
    status: 429,
    code: "VAEORA_RATE_LIMITED",
    message: "Creative generation is temporarily busy. Try again shortly.",
    retryAfter: 30,
  },
  rejected: {
    status: 422,
    code: "VAEORA_CONTENT_REJECTED",
    message: "The creative request could not be generated safely.",
  },
  unsupported_preset: {
    status: 422,
    code: "VAEORA_UNSUPPORTED_PRESET",
    message: "The selected creative preset is not supported by the configured model.",
  },
  timeout: {
    status: 504,
    code: "VAEORA_PROVIDER_TIMEOUT",
    message: "Creative generation took too long. Try again.",
  },
  empty_result: {
    status: 502,
    code: "VAEORA_EMPTY_RESULT",
    message: "VAEORA did not receive a usable creative result.",
  },
  invalid_result: {
    status: 502,
    code: "VAEORA_PROVIDER_ERROR",
    message: "VAEORA received an invalid creative result.",
  },
  unavailable: {
    status: 502,
    code: "VAEORA_PROVIDER_ERROR",
    message: "VAEORA could not complete creative generation.",
  },
};

export function toCreativePublicError(
  error: unknown,
  requestId: string,
): CreativePublicError {
  if (error instanceof CreativeRequestError) {
    return {
      status: error.status,
      ...(error.retryAfter
        ? { retryAfter: error.retryAfter }
        : {}),
      body: {
        error: error.publicMessage,
        code: error.code,
        requestId,
      },
    };
  }

  if (error instanceof CreativeProviderError) {
    const mapped = PROVIDER_ERROR_MAP[error.kind];

    return {
      status: mapped.status,
      ...(mapped.retryAfter
        ? { retryAfter: mapped.retryAfter }
        : {}),
      body: {
        error: mapped.message,
        code: mapped.code,
        requestId,
      },
    };
  }

  return {
    status: 502,
    body: {
      error: "VAEORA could not complete creative generation.",
      code: "VAEORA_PROVIDER_ERROR",
      requestId,
    },
  };
}

export function describeCreativeFailure(
  error: unknown,
): Record<string, string | number | undefined> {
  if (error instanceof CreativeProviderError) {
    return {
      name: error.name,
      kind: error.kind,
      providerRequestId: error.providerRequestId,
    };
  }

  if (error instanceof CreativeRequestError) {
    return {
      name: error.name,
      code: error.code,
      status: error.status,
    };
  }

  return {
    name: error instanceof Error ? error.name : "UnknownError",
  };
}
