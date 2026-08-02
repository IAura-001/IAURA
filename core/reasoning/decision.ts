import type { ReasoningAnalysis } from "./analyzer";
import type { ReasoningPlan } from "./planner";

export type ResponseDepth = "brief" | "standard" | "deep";

export type ResponseFormat =
  | "direct"
  | "steps"
  | "comparison"
  | "strategy"
  | "reflection";

export interface ResponseDecision {
  depth: ResponseDepth;
  format: ResponseFormat;
  shouldAskQuestion: boolean;
  shouldRecommendAction: boolean;
  shouldUseSections: boolean;
  maximumSuggestedSteps: number;
}

function selectDepth(
  analysis: ReasoningAnalysis
): ResponseDepth {
  if (analysis.complexity === "complex") {
    return "deep";
  }

  if (analysis.complexity === "moderate") {
    return "standard";
  }

  return "brief";
}

function selectFormat(
  analysis: ReasoningAnalysis
): ResponseFormat {
  switch (analysis.primaryIntent) {
    case "decide":
    case "evaluate":
      return "comparison";

    case "plan":
      return "strategy";

    case "execute":
    case "solve":
    case "create":
    case "improve":
      return "steps";

    case "reflect":
      return "reflection";

    default:
      return "direct";
  }
}

export function decideResponse(
  analysis: ReasoningAnalysis,
  plan: ReasoningPlan
): ResponseDecision {
  const depth = selectDepth(analysis);

  return {
    depth,
    format: selectFormat(analysis),
    shouldAskQuestion: plan.needsClarification,
    shouldRecommendAction: !plan.needsClarification,
    shouldUseSections:
      depth !== "brief" ||
      analysis.primaryIntent === "plan" ||
      analysis.primaryIntent === "evaluate",
    maximumSuggestedSteps:
      depth === "deep" ? 7 : depth === "standard" ? 5 : 3,
  };
}