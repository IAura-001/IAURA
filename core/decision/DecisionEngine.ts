import { performanceMonitor } from "@/core/performance";
import type {
  BrainContext,
  BrainDecision,
  ThinkingMode,
} from "../brain/types";

interface ModeRule {
  mode: ThinkingMode;
  keywords: string[];
  reason: string;
}

const MODE_RULES: ModeRule[] = [
  {
    mode: "planner",
    keywords: [
  "plan",
  "planning",
  "roadmap",
  "schedule",
  "organize",
  "steps",
  "strategy",
  "timeline",
  "goal",
  "priority"
],
    reason:
      "The request requires organization and actionable steps.",
  },
  {
    mode: "mentor",
    keywords: [
  "explain",
  "teach",
  "learn",
  "understand",
  "why",
  "how",
  "guide",
  "example"
],
    reason:
      "The request would benefit from teaching and explanation.",
  },
  {
    mode: "analyst",
    keywords: [
      "analyze",
      "compare",
      "evaluate",
      "risk",
      "difference",
    ],
    reason:
      "The request requires comparison or deeper analysis.",
  },
  {
    mode: "creative",
    keywords: [
      "create",
      "design",
      "idea",
      "brainstorm",
      "imagine",
    ],
    reason:
      "The request requires creativity and idea generation.",
  },
  {
    mode: "coach",
    keywords: [
      "motivate",
      "discipline",
      "habit",
      "consistency",
      "progress",
    ],
    reason:
      "The request requires encouragement and progress guidance.",
  },
];

export function makeBrainDecision(
  context: BrainContext
): BrainDecision {
  const startedAt =
    typeof performance !== "undefined"
      ? performance.now()
      : Date.now();

  const normalizedMessage =
    context.message.toLowerCase();

  const matchedRule = MODE_RULES.find((rule) =>
    rule.keywords.some((keyword) =>
      normalizedMessage.includes(keyword)
    )
  );

  const decision: BrainDecision = matchedRule
    ? {
        mode: matchedRule.mode,
        reason: matchedRule.reason,
      }
    : {
        mode: "executor",
        reason:
          "The request can be handled with a direct and actionable response.",
      };

  const finishedAt =
    typeof performance !== "undefined"
      ? performance.now()
      : Date.now();

  performanceMonitor.recordDecision(
    finishedAt - startedAt
  );

  return decision;
}
 