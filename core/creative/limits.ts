import { createHash } from "node:crypto";

import { ACCESS_COOKIE_NAME } from "@/core/auth/access";

import { CreativeRequestError } from "./errors";
import type { CreativeImageTier } from "./types";

export type CreativeGenerationKind = "copy" | "image";

interface CreativeGenerationPolicy {
  windowMs: number;
  maxUnits: number;
  maxConcurrent: number;
  maxScopeUnits: number;
  maxScopeConcurrent: number;
  duplicateWindowMs: number;
  concurrencyRetryAfter: number;
}

interface CreativeGenerationState {
  windowStartedAt: number | null;
  usedUnits: number;
  inFlight: number;
}

interface CreativeKindState {
  global: CreativeGenerationState;
  scopes: Map<string, CreativeGenerationState>;
  recentRequests: Map<string, number>;
}

export interface CreativeGenerationLeaseOptions {
  now?: number;
  scope?: string;
  fingerprint?: string;
  signal?: AbortSignal;
}

export interface CreativeGenerationLease {
  release(): Promise<void>;
}

interface CreativeRuntimeEnvironment {
  NODE_ENV?: string;
  VAEORA_CREATIVE_PRODUCTION_GUARD?: string;
}

export const CREATIVE_PRODUCTION_GUARD_VALUE =
  "external-controls-configured";

const MAX_TRACKED_SCOPES = 512;
const MAX_RECENT_REQUESTS = 1_024;

export const CREATIVE_GENERATION_POLICIES: Record<
  CreativeGenerationKind,
  CreativeGenerationPolicy
> = {
  copy: {
    windowMs: 60_000,
    maxUnits: 12,
    maxConcurrent: 2,
    maxScopeUnits: 8,
    maxScopeConcurrent: 1,
    duplicateWindowMs: 5_000,
    concurrencyRetryAfter: 2,
  },
  image: {
    windowMs: 10 * 60_000,
    // Covers a deliberate exploration pass plus a coordinated six-asset
    // Studio kit while the production guard remains fail-closed.
    maxUnits: 36,
    maxConcurrent: 1,
    maxScopeUnits: 24,
    maxScopeConcurrent: 1,
    duplicateWindowMs: 30_000,
    concurrencyRetryAfter: 5,
  },
};

const createState = (): CreativeGenerationState => ({
  windowStartedAt: null,
  usedUnits: 0,
  inFlight: 0,
});

const createKindState = (): CreativeKindState => ({
  global: createState(),
  scopes: new Map(),
  recentRequests: new Map(),
});

const states: Record<CreativeGenerationKind, CreativeKindState> = {
  copy: createKindState(),
  image: createKindState(),
};

function digest(value: string): string {
  return createHash("sha256").update(value).digest("base64url");
}

function firstHeaderValue(value: string | null): string {
  return value?.split(",", 1)[0]?.trim().slice(0, 200) || "unknown";
}

function readCookie(request: Request, name: string): string | null {
  const header = request.headers.get("cookie");
  if (!header) return null;

  for (const cookie of header.split(";")) {
    const [cookieName, ...valueParts] = cookie.trim().split("=");
    if (cookieName !== name) continue;

    try {
      return decodeURIComponent(valueParts.join("="));
    } catch {
      return null;
    }
  }

  return null;
}

/**
 * Produces a non-reversible, process-local quota key. Authenticated sessions
 * use their signed access cookie; the network fingerprint is only a fallback.
 */
export function createCreativeGenerationScope(request: Request): string {
  const accessToken = readCookie(request, ACCESS_COOKIE_NAME);
  if (accessToken) return digest(`access:${accessToken}`);

  const address =
    firstHeaderValue(request.headers.get("cf-connecting-ip")) !== "unknown"
      ? firstHeaderValue(request.headers.get("cf-connecting-ip"))
      : firstHeaderValue(request.headers.get("x-real-ip")) !== "unknown"
        ? firstHeaderValue(request.headers.get("x-real-ip"))
        : firstHeaderValue(request.headers.get("x-forwarded-for"));
  const userAgent = firstHeaderValue(request.headers.get("user-agent"));

  return digest(`network:${address}|${userAgent}`);
}

export function createCreativeRequestFingerprint(
  kind: CreativeGenerationKind,
  scope: string,
  payload: unknown,
): string {
  let serialized: string;

  try {
    serialized = JSON.stringify(payload);
  } catch {
    serialized = "unserializable";
  }

  return digest(`${kind}|${scope}|${serialized}`);
}

/**
 * Local development and tests remain available by default. Production is
 * deliberately fail-closed because an in-memory limiter cannot enforce a
 * budget across serverless instances, processes, restarts, or regions.
 */
export function isCreativeGenerationDeploymentReady(
  environment: CreativeRuntimeEnvironment = process.env,
): boolean {
  if (environment.NODE_ENV !== "production") return true;

  return (
    environment.VAEORA_CREATIVE_PRODUCTION_GUARD?.trim() ===
    CREATIVE_PRODUCTION_GUARD_VALUE
  );
}

export function assertCreativeGenerationDeploymentReady(
  environment: CreativeRuntimeEnvironment = process.env,
): void {
  if (isCreativeGenerationDeploymentReady(environment)) return;

  throw new CreativeRequestError(
    503,
    "VAEORA_CREATIVE_NOT_CONFIGURED",
    "VAEORA paid generation is disabled until production cost controls are configured.",
  );
}

function refreshWindow(
  state: CreativeGenerationState,
  policy: CreativeGenerationPolicy,
  now: number,
): void {
  if (
    state.windowStartedAt === null ||
    now < state.windowStartedAt ||
    now - state.windowStartedAt >= policy.windowMs
  ) {
    state.windowStartedAt = now;
    state.usedUnits = 0;
  }
}

function windowRetryAfter(
  state: CreativeGenerationState,
  policy: CreativeGenerationPolicy,
  now: number,
): number {
  const startedAt = state.windowStartedAt ?? now;
  return Math.max(
    1,
    Math.ceil((startedAt + policy.windowMs - now) / 1_000),
  );
}

function pruneKindState(
  state: CreativeKindState,
  policy: CreativeGenerationPolicy,
  now: number,
): void {
  for (const [fingerprint, expiresAt] of state.recentRequests) {
    if (expiresAt <= now) state.recentRequests.delete(fingerprint);
  }

  for (const [scope, scopeState] of state.scopes) {
    const expired =
      scopeState.windowStartedAt === null ||
      now < scopeState.windowStartedAt ||
      now - scopeState.windowStartedAt >= policy.windowMs;
    if (expired && scopeState.inFlight === 0) state.scopes.delete(scope);
  }

  while (state.scopes.size >= MAX_TRACKED_SCOPES) {
    const removable = Array.from(state.scopes).find(
      ([, scopeState]) => scopeState.inFlight === 0,
    );
    if (!removable) break;
    state.scopes.delete(removable[0]);
  }

  while (state.recentRequests.size >= MAX_RECENT_REQUESTS) {
    const oldest = state.recentRequests.keys().next().value as
      | string
      | undefined;
    if (!oldest) break;
    state.recentRequests.delete(oldest);
  }
}

function assertCapacity(
  state: CreativeGenerationState,
  policy: CreativeGenerationPolicy,
  normalizedUnits: number,
  maxUnits: number,
  maxConcurrent: number,
  now: number,
): void {
  if (state.inFlight >= maxConcurrent) {
    throw new CreativeRequestError(
      429,
      "VAEORA_RATE_LIMITED",
      "Creative generation is already in progress. Try again shortly.",
      policy.concurrencyRetryAfter,
    );
  }

  if (state.usedUnits + normalizedUnits > maxUnits) {
    throw new CreativeRequestError(
      429,
      "VAEORA_RATE_LIMITED",
      "Creative generation has reached its temporary usage limit.",
      windowRetryAfter(state, policy, now),
    );
  }
}

export function creativeImageCostUnits(
  tier: CreativeImageTier,
): number {
  if (tier === "ultra") return 6;
  if (tier === "premium") return 2;
  return 1;
}

/**
 * Async by design so a durable, atomic limiter can replace or precede this
 * defense-in-depth layer without changing Route Handler call sites.
 */
export async function acquireCreativeGenerationLease(
  kind: CreativeGenerationKind,
  units = 1,
  options: CreativeGenerationLeaseOptions = {},
): Promise<CreativeGenerationLease> {
  if (options.signal?.aborted) {
    throw new DOMException("The creative request was aborted.", "AbortError");
  }

  const now = options.now ?? Date.now();
  const policy = CREATIVE_GENERATION_POLICIES[kind];
  const kindState = states[kind];
  const globalState = kindState.global;
  const normalizedUnits = Math.max(1, Math.floor(units));
  const normalizedScope = options.scope?.trim() || null;
  const normalizedFingerprint = options.fingerprint?.trim() || null;

  refreshWindow(globalState, policy, now);
  pruneKindState(kindState, policy, now);

  const scopeState = normalizedScope
    ? kindState.scopes.get(normalizedScope) ?? createState()
    : null;
  if (scopeState) {
    refreshWindow(scopeState, policy, now);
  }

  assertCapacity(
    globalState,
    policy,
    normalizedUnits,
    policy.maxUnits,
    policy.maxConcurrent,
    now,
  );
  if (scopeState) {
    assertCapacity(
      scopeState,
      policy,
      normalizedUnits,
      policy.maxScopeUnits,
      policy.maxScopeConcurrent,
      now,
    );
  }

  if (normalizedFingerprint) {
    const duplicateExpiresAt = kindState.recentRequests.get(
      normalizedFingerprint,
    );
    if (duplicateExpiresAt && duplicateExpiresAt > now) {
      throw new CreativeRequestError(
        429,
        "VAEORA_RATE_LIMITED",
        "An identical creative request was already accepted. Try again shortly.",
        Math.max(1, Math.ceil((duplicateExpiresAt - now) / 1_000)),
      );
    }
  }

  globalState.usedUnits += normalizedUnits;
  globalState.inFlight += 1;
  if (scopeState && normalizedScope) {
    scopeState.usedUnits += normalizedUnits;
    scopeState.inFlight += 1;
    kindState.scopes.set(normalizedScope, scopeState);
  }
  if (normalizedFingerprint) {
    kindState.recentRequests.set(
      normalizedFingerprint,
      now + policy.duplicateWindowMs,
    );
  }

  let released = false;

  return {
    async release(): Promise<void> {
      if (released) return;
      released = true;
      globalState.inFlight = Math.max(0, globalState.inFlight - 1);
      if (scopeState) {
        scopeState.inFlight = Math.max(0, scopeState.inFlight - 1);
      }
    },
  };
}

export function resetCreativeGenerationLimitsForTests(): void {
  for (const kind of ["copy", "image"] as const) {
    states[kind] = createKindState();
  }
}
