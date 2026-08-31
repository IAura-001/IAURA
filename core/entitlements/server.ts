import "server-only";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { DEFAULT_ENTITLEMENT_PROFILE_ID } from "./model";
import type { EntitlementCapability, EntitlementDecision, EntitlementLimits,
  EntitlementUsage } from "./types";

export interface EffectiveEntitlements {
  profileId: string;
  capabilities: EntitlementCapability[];
  limits: EntitlementLimits;
  usage: EntitlementUsage;
  period: { kind: "calendar_month"; startsAt: string; resetsAt: string };
  assignment: { startsAt: string | null; endsAt: string | null };
}
export class EntitlementSystemError extends Error {}
export class EntitlementDeniedError extends Error {
  constructor(public readonly decision: EntitlementDecision) { super(decision.reason); }
}

export async function getEffectiveEntitlements(request?: Request): Promise<EffectiveEntitlements> {
  const supabase = await createServerSupabaseClient(request);
  const { data, error } = await supabase.rpc("resolve_current_entitlements");
  if (error || !data) throw new EntitlementSystemError("Entitlements are temporarily unavailable.");
  return data as EffectiveEntitlements;
}

export function safeEntitlementView(state: EffectiveEntitlements) {
  return { profileId: state.profileId || DEFAULT_ENTITLEMENT_PROFILE_ID,
    capabilities: state.capabilities, limits: state.limits, usage: state.usage,
    period: state.period, assignment: state.assignment };
}

export function entitlementDeniedResponse(error: EntitlementDeniedError) {
  return Response.json({ error: "This limit has been reached.", code: error.decision.reason,
    decision: error.decision }, { status: 403, headers: { "Cache-Control": "no-store" } });
}
