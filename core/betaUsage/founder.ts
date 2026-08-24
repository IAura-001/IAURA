import { BETA_LIFECYCLE_THRESHOLDS_DAYS, type FounderBetaOperations,
  type FounderBetaUsageRow, type LifecycleStatus } from "./types";

export interface UsageRpcRow {
  user_id: string; email: string | null; display_name: string | null;
  registered_at: string; beta_joined_at: string; last_sign_in_at: string | null;
  last_active_at: string | null; project_count: number; conversation_count: number;
  message_count: number; meaningful_interaction_count: number; latest_milestone: string | null;
  evidence_source: FounderBetaUsageRow["evidenceSource"];
  data_quality_issues: string[] | null;
}

export class FounderUsageAccessError extends Error {}
export class FounderUsageServerError extends Error {}

const DAY_MS = 86_400_000;
export function classifyLifecycle(count: number, lastActiveAt: string | null, now = new Date()): LifecycleStatus {
  if (count < 1) return "NEVER_ACTIVATED";
  if (!lastActiveAt) return "DORMANT";
  const timestamp = Date.parse(lastActiveAt);
  if (!Number.isFinite(timestamp)) return "DORMANT";
  const ageDays = Math.max(0, (now.getTime() - timestamp) / DAY_MS);
  if (ageDays <= BETA_LIFECYCLE_THRESHOLDS_DAYS.active) return "ACTIVE";
  if (ageDays <= BETA_LIFECYCLE_THRESHOLDS_DAYS.atRisk) return "AT_RISK";
  return "DORMANT";
}

const attentionOrder: Record<LifecycleStatus, number> = {
  AT_RISK: 0, NEVER_ACTIVATED: 1, DORMANT: 2, ACTIVE: 3,
};

export function founderUsageResult(
  data: UsageRpcRow[] | null,
  error: { code?: string } | null,
  now = new Date(),
): FounderBetaOperations {
  if (error?.code === "42501") throw new FounderUsageAccessError("Founder access required.");
  if (error) throw new FounderUsageServerError("Beta operations data is unavailable.");
  const users = (data ?? []).map((row): FounderBetaUsageRow => {
    const meaningfulInteractionCount = Number(row.meaningful_interaction_count) || 0;
    return {
    userId: row.user_id, email: row.email, displayName: row.display_name,
    registeredAt: row.registered_at, betaJoinedAt: row.beta_joined_at,
    lastSignInAt: row.last_sign_in_at, lastActiveAt: row.last_active_at,
    projectCount: Number(row.project_count), conversationCount: Number(row.conversation_count),
    messageCount: Number(row.message_count), meaningfulInteractionCount,
    activationStatus: meaningfulInteractionCount > 0 ? "ACTIVATED" : "REGISTERED_ONLY",
    lifecycleStatus: classifyLifecycle(meaningfulInteractionCount, row.last_active_at, now),
    latestMilestone: row.latest_milestone, evidenceSource: row.evidence_source,
    dataQualityIssues: Array.isArray(row.data_quality_issues) ? row.data_quality_issues : [],
  }; }).sort((a, b) => attentionOrder[a.lifecycleStatus] - attentionOrder[b.lifecycleStatus]
    || (a.lastActiveAt ?? "").localeCompare(b.lastActiveAt ?? "")
    || a.registeredAt.localeCompare(b.registeredAt) || a.userId.localeCompare(b.userId));
  return { generatedAt: now.toISOString(), summary: {
    totalRegistered: users.length,
    activated: users.filter((u) => u.activationStatus === "ACTIVATED").length,
    neverActivated: users.filter((u) => u.lifecycleStatus === "NEVER_ACTIVATED").length,
    active: users.filter((u) => u.lifecycleStatus === "ACTIVE").length,
    atRisk: users.filter((u) => u.lifecycleStatus === "AT_RISK").length,
    dormant: users.filter((u) => u.lifecycleStatus === "DORMANT").length,
    totalMeaningfulInteractions: users.reduce((sum, u) => sum + u.meaningfulInteractionCount, 0),
    usersWithDataQualityIssues: users.filter((u) => u.dataQualityIssues.length > 0).length,
  }, users };
}
