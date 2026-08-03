import {
  analyzeRequest,
  type AnalyzeRequestOptions,
  type ReasoningAnalysis,
  type ReasoningIntent,
} from "./analyzer";
import {
  decideResponse,
  type ResponseDecision,
} from "./decision";
import {
  createReasoningPlan,
  type ReasoningPlan,
} from "./planner";
import { buildReasoningInstructions } from "./response";

export type {
  AnalyzeRequestOptions,
  ReasoningAnalysis,
  ReasoningIntent,
  ReasoningPlan,
  ResponseDecision,
};

export interface ReasoningResult {
  analysis: ReasoningAnalysis;
  plan: ReasoningPlan;
  decision: ResponseDecision;
  instructions: string;
}

export function reasonAboutRequest(
  input: string,
  options: AnalyzeRequestOptions = {}
): ReasoningResult {
  const analysis = analyzeRequest(input, options);
  const plan = createReasoningPlan(analysis);
  const decision = decideResponse(analysis, plan);
  const instructions = buildReasoningInstructions({
    analysis,
    plan,
    decision,
  });

  return {
    analysis,
    plan,
    decision,
    instructions,
  };
}
