import type { BetaUsageEventType } from "./types";

export interface BetaUsageEventInput {
  type: BetaUsageEventType;
  projectId?: string | null;
  milestone?: string;
  eventKey?: string;
  source?: string;
  inputMode?: "text" | "voice";
  durableKind?: string;
}

const SESSION_KEY = "vaeora.product-session.v1";

export function productSessionId(): string | undefined {
  if (typeof window === "undefined") return undefined;
  try {
    const existing = window.sessionStorage.getItem(SESSION_KEY);
    if (existing) return existing;
    const created = crypto.randomUUID();
    window.sessionStorage.setItem(SESSION_KEY, created);
    return created;
  } catch {
    return undefined;
  }
}

export async function trackBetaUsage(input: BetaUsageEventInput): Promise<boolean> {
  try {
    const response = await fetch("/api/beta-usage", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ...input, sessionId: productSessionId(), schemaVersion: 1 }),
      keepalive: true,
    });
    if (!response.ok) return false;
    const result = await response.json().catch(() => null) as { recorded?: unknown } | null;
    return result?.recorded === true;
  } catch {
    // Telemetry is deliberately best-effort and never blocks IAURA.
    return false;
  }
}
