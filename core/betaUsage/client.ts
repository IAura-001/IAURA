import type { BetaUsageEventType } from "./types";

export interface BetaUsageEventInput {
  type: BetaUsageEventType;
  projectId?: string | null;
  milestone?: string;
}

export async function trackBetaUsage(input: BetaUsageEventInput): Promise<boolean> {
  try {
    const response = await fetch("/api/beta-usage", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(input),
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
