export const BETA_USAGE_EVENT_TYPES = [
  "beta_signed_in",
  "project_opened",
  "project_created",
  "message_sent",
  "beta_step_completed",
] as const;

export type BetaUsageEventType = typeof BETA_USAGE_EVENT_TYPES[number];

export interface FounderBetaUsageRow {
  userId: string;
  email: string | null;
  displayName: string | null;
  joinedAt: string;
  accountCreatedAt: string;
  lastSignInAt: string | null;
  lastActiveAt: string | null;
  projectCount: number;
  conversationCount: number;
  userMessageCount: number;
  latestMilestone: string | null;
  usageStatus: "joined" | "entered" | "started" | "active" | "returned";
  evidenceSource: "none" | "inferred" | "explicit";
}
