import type { ConversationMessage } from "../conversation/ConversationMemory";
import type { IAuraProject } from "@/types/project";
import type { AutonomyAssessment } from "../autonomy";
import type {
  ReasoningAnalysis,
  ReasoningPlan,
  ResponseDecision,
} from "../reasoning";

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
  activeProject?: IAuraProject | null;
  conversationIdentity?: {
    conversationId: string;
    projectId?: string;
  };
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

export interface BrainStructuredReasoning {
  analysis: Omit<
    ReasoningAnalysis,
    | "originalInput"
    | "normalizedInput"
    | "relevantContext"
    | "objective"
  >;
  plan: Omit<ReasoningPlan, "objective">;
  responseDecision: ResponseDecision;
  guidance: string;
}

export interface BrainStructuredContext {
  userContext: string;
  conversationHistory: ConversationMessage[];
  createdAt: string;
  decision: BrainDecision;
  autonomy: AutonomyAssessment;
  reasoning: BrainStructuredReasoning;
}

export interface CognitiveRequest {
  originalUserMessage: string;
  structuredContext: BrainStructuredContext;
  compiledPrompt: string;
  projectId?: string;
}

export interface BrainResult extends CognitiveRequest {
  context: BrainContext;
  decision: BrainDecision;
  autonomy: AutonomyAssessment;
  prompt: string;
  validated: true;
}
