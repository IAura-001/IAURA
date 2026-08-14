import type {
  AuraExperience,
  BetaExecutionEvaluation,
  BetaSessionEvaluation,
  BetaNextStepRecommendation,
} from "@/core/actions";

export interface ChatMessage {
  id: string;
  role: "user" | "assistant";
  content: string;
  experience?: AuraExperience;
  betaNextStep?: BetaNextStepRecommendation;
  betaNextStepConfirmed?: boolean;
  betaSessionDecision?: "start-now" | "continue-later";
  betaExecutionEvaluation?: BetaExecutionEvaluation;
  betaExecutionVerified?: boolean;
  betaSessionEvaluation?: BetaSessionEvaluation;
  betaSessionEvaluationConfirmed?: boolean;
  betaSessionClosed?: boolean;
}
