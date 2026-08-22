import type {
  AuraExperience,
  BetaPostClosureDecision,
  BetaExecutionEvaluation,
  BetaIncompleteExecutionRecoveryDecision,
  BetaSessionEvaluation,
  BetaNextStepRecommendation,
} from "@/core/actions";

export interface ChatMessage {
  id: string;
  role: "user" | "assistant";
  content: string;
  experience?: AuraExperience;
  intelligenceActionResolved?: boolean;
  betaNextStep?: BetaNextStepRecommendation;
  betaNextStepConfirmed?: boolean;
  betaSessionDecision?: "start-now" | "continue-later";
  betaSessionDecisionConfirmed?: boolean;
  betaExecutionEvaluation?: BetaExecutionEvaluation;
  betaExecutionVerified?: boolean;
  betaIncompleteExecutionRecoveryDecision?: BetaIncompleteExecutionRecoveryDecision;
  betaSessionEvaluation?: BetaSessionEvaluation;
  betaSessionEvaluationConfirmed?: boolean;
  betaSessionClosed?: boolean;
  betaPostClosureDecision?: BetaPostClosureDecision;
}
