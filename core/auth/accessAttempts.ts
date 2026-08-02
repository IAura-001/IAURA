import { createHash } from "node:crypto";

export const ACCESS_ATTEMPT_WINDOW_MS = 15 * 60_000;
export const ACCESS_ATTEMPT_MAX_FAILURES = 8;

const MAX_TRACKED_CLIENTS = 512;

interface AttemptWindow {
  startedAt: number;
  failures: number;
}

export interface AccessAttemptStatus {
  allowed: boolean;
  retryAfter?: number;
}

const clientAttempts = new Map<string, AttemptWindow>();

function firstHeaderValue(value: string | null): string {
  return value?.split(",", 1)[0]?.trim().slice(0, 160) || "unknown";
}

function clientKey(request: Request): string {
  const address =
    firstHeaderValue(request.headers.get("cf-connecting-ip")) !== "unknown"
      ? firstHeaderValue(request.headers.get("cf-connecting-ip"))
      : firstHeaderValue(request.headers.get("x-real-ip")) !== "unknown"
        ? firstHeaderValue(request.headers.get("x-real-ip"))
        : firstHeaderValue(request.headers.get("x-forwarded-for"));

  return createHash("sha256")
    .update(address)
    .digest("base64url");
}

function isExpired(window: AttemptWindow, now: number): boolean {
  return (
    now < window.startedAt ||
    now - window.startedAt >= ACCESS_ATTEMPT_WINDOW_MS
  );
}

function retryAfter(window: AttemptWindow, now: number): number {
  return Math.max(
    1,
    Math.ceil(
      (window.startedAt + ACCESS_ATTEMPT_WINDOW_MS - now) / 1_000,
    ),
  );
}

function pruneClients(now: number): void {
  for (const [key, window] of clientAttempts) {
    if (isExpired(window, now)) clientAttempts.delete(key);
  }

  while (clientAttempts.size >= MAX_TRACKED_CLIENTS) {
    const oldestKey = clientAttempts.keys().next().value as
      | string
      | undefined;
    if (!oldestKey) break;
    clientAttempts.delete(oldestKey);
  }
}

export function getAccessAttemptStatus(
  request: Request,
  now = Date.now(),
): AccessAttemptStatus {
  const key = clientKey(request);
  const client = clientAttempts.get(key);

  if (client && isExpired(client, now)) {
    clientAttempts.delete(key);
  }

  const activeClient = clientAttempts.get(key);
  const blockedWindow =
    activeClient && activeClient.failures >= ACCESS_ATTEMPT_MAX_FAILURES
      ? activeClient
      : null;

  if (!blockedWindow) return { allowed: true };

  return {
    allowed: false,
    retryAfter: retryAfter(blockedWindow, now),
  };
}

export function recordAccessFailure(
  request: Request,
  now = Date.now(),
): void {
  pruneClients(now);
  const key = clientKey(request);
  const existingClient = clientAttempts.get(key);

  if (!existingClient || isExpired(existingClient, now)) {
    clientAttempts.set(key, {
      startedAt: now,
      failures: 1,
    });
  } else {
    existingClient.failures += 1;
  }
}

export function clearAccessFailures(request: Request): void {
  clientAttempts.delete(clientKey(request));
}

export function resetAccessAttemptLimitsForTests(): void {
  clientAttempts.clear();
}
