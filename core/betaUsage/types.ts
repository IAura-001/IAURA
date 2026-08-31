export const BETA_USAGE_EVENT_TYPES = [
  "beta_signed_in",
  "project_opened",
  "project_created",
  "message_sent",
  "beta_step_completed",
  "meaningful_session",
  "first_intent_submitted",
  "project_scoped_result",
  "durable_output",
  "activated",
  "launch_foundation_progress",
  "launch_foundation_completed",
] as const;

export type BetaUsageEventType = typeof BETA_USAGE_EVENT_TYPES[number];
export type ActivationStatus = "REGISTERED_ONLY" | "ACTIVATED";
export type LifecycleStatus = "NEVER_ACTIVATED" | "ACTIVE" | "AT_RISK" | "DORMANT";

export const BETA_LIFECYCLE_THRESHOLDS_DAYS = { active: 7, atRisk: 21 } as const;

export interface FounderBetaUsageRow {
  userId: string;
  email: string | null;
  displayName: string | null;
  registeredAt: string;
  betaJoinedAt: string;
  lastSignInAt: string | null;
  lastActiveAt: string | null;
  projectCount: number;
  conversationCount: number;
  messageCount: number;
  meaningfulInteractionCount: number;
  activatedAt: string | null;
  activationStatus: ActivationStatus;
  lifecycleStatus: LifecycleStatus;
  latestMilestone: string | null;
  evidenceSource: "none" | "inferred" | "explicit";
  dataQualityIssues: string[];
}

export interface FounderBetaOperations {
  generatedAt: string;
  summary: {
    totalRegistered: number; activated: number; neverActivated: number;
    active: number; atRisk: number; dormant: number;
    totalMeaningfulInteractions: number; usersWithDataQualityIssues: number;
    medianMinutesToActivation: number | null;
  };
  users: FounderBetaUsageRow[];
}
