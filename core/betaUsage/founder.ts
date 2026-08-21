import type { FounderBetaUsageRow } from "./types";

export interface UsageRpcRow {
  user_id: string; email: string | null; display_name: string | null;
  joined_at: string; account_created_at: string; last_sign_in_at: string | null;
  last_active_at: string | null; project_count: number; conversation_count: number;
  user_message_count: number; latest_milestone: string | null;
  usage_status: FounderBetaUsageRow["usageStatus"];
  evidence_source: FounderBetaUsageRow["evidenceSource"];
}

export class FounderUsageAccessError extends Error {}

export function founderUsageResult(
  data: UsageRpcRow[] | null,
  error: unknown,
): FounderBetaUsageRow[] {
  if (error) throw new FounderUsageAccessError("Founder access required.");
  return (data ?? []).map((row) => ({
    userId: row.user_id, email: row.email, displayName: row.display_name,
    joinedAt: row.joined_at, accountCreatedAt: row.account_created_at,
    lastSignInAt: row.last_sign_in_at, lastActiveAt: row.last_active_at,
    projectCount: Number(row.project_count), conversationCount: Number(row.conversation_count),
    userMessageCount: Number(row.user_message_count), latestMilestone: row.latest_milestone,
    usageStatus: row.usage_status, evidenceSource: row.evidence_source,
  }));
}
