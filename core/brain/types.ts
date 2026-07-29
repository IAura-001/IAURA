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
  validated: boolean;
}