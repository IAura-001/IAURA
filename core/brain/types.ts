import type { ConversationMessage } from "../conversation/ConversationMemory";
import type { AutonomyAssessment } from "../autonomy";

export type ThinkingMode =
  | "mentor"
  | "planner"
  | "analyst"
  | "executor"
  | "creative"
  | "coach";

export interface BrainInput {
  message: string;
  userContext?: string;
  history?: ConversationMessage[];
}

export interface BrainContext {
  message: string;
  userContext: string;
  createdAt: string;
}

export interface BrainDecision {
  mode: ThinkingMode;
  reason: string;
}

export interface BrainResult {
  context: BrainContext;
  decision: BrainDecision;
  autonomy: AutonomyAssessment;
  prompt: string;
  validated: boolean;
}
