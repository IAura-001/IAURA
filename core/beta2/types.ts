import type { LaunchFoundationMilestone } from "@/core/betaUsage/funnel";

export const BETA2_PARTICIPANT_STATUSES = ["INVITED", "JOINED", "STARTED", "ACTIVATED", "RETURNING", "COMPLETED", "INACTIVE"] as const;
export type Beta2ParticipantStatus = typeof BETA2_PARTICIPANT_STATUSES[number];
export const BETA_FEEDBACK_CATEGORIES = ["bug", "confusing", "missing", "valuable", "other"] as const;
export type BetaFeedbackCategory = typeof BETA_FEEDBACK_CATEGORIES[number];
export const BETA_FEEDBACK_KINDS = ["contextual", "activation_check", "artifact_check", "exit_survey", "support"] as const;
export type BetaFeedbackKind = typeof BETA_FEEDBACK_KINDS[number];

export interface Beta2ParticipantFacts {
  userId: string; email: string | null; invitedAt: string; joinedAt: string | null;
  firstIntentAt: string | null; projectCreatedAt: string | null; firstResultAt: string | null;
  activatedAt: string | null; meaningfulSessionDates: string[]; lastMeaningfulAt: string | null;
  completedAt: string | null; milestones: LaunchFoundationMilestone[];
  aiCostUsd: number; unpricedOperations: number; failedOperations: number;
  entitlementDenials: number | null; unresolvedFeedback: number;
}
export interface Beta2Participant extends Beta2ParticipantFacts {
  status: Beta2ParticipantStatus; d1: boolean; d7: boolean;
  minutesToActivation: number | null; abandonment: string | null;
}

export interface Beta2Dashboard {
  generatedAt: string; participants: Beta2Participant[];
  summary: { invited: number; joined: number; started: number; activated: number;
    returning: number; completed: number; inactive: number; d1: number; d7: number;
    inviteToSignupRate: number | null; signupToIntentRate: number | null;
    intentToProjectRate: number | null; projectToResultRate: number | null;
    activationRate: number | null; completionRate: number | null;
    medianMinutesToActivation: number | null; totalAiCostUsd: number;
    costPerActivatedUser: number | null; costPerCompletedUser: number | null;
    unpricedOperations: number; failedOperations: number; unresolvedFeedback: number; };
}
