import { assessAutonomy } from "../autonomy";
import { buildBrainContext } from "../context/ContextBuilder";
import { performanceMonitor } from "../performance";
import { promptBuilder } from "../prompt";
import {
  reasonAboutRequest,
  type ReasoningIntent,
  type ReasoningResult,
} from "../reasoning";
import {
  assertValidBrainInput,
  assertValidBrainResult,
  assertValidCognitiveRequest,
  BrainValidationError,
  validateBrainResult,
} from "../validator/ResponseValidator";
import type { ConversationMessage } from "../conversation/ConversationMemory";
import type {
  BrainDecision,
  BrainInput,
  BrainResult,
  BrainStructuredContext,
  BrainStructuredReasoning,
  CognitiveRequest,
  ThinkingMode,
} from "./types";

const INTENT_MODE_MAP: Record<ReasoningIntent, ThinkingMode> = {
  understand: "mentor",
  learn: "mentor",
  decide: "analyst",
  solve: "executor",
  create: "creative",
  plan: "planner",
  execute: "executor",
  evaluate: "analyst",
  improve: "executor",
  reflect: "coach",
};

function previousConversationHistory(
  history: ConversationMessage[] | undefined,
  currentMessage: string,
): ConversationMessage[] {
  const previousHistory = (history ?? []).map((message) => ({
    ...message,
  }));
  const trailingMessage = previousHistory.at(-1);

  if (
    trailingMessage?.role === "user" &&
    trailingMessage.content.trim() === currentMessage
  ) {
    previousHistory.pop();
  }

  return previousHistory;
}

function toBrainDecision(
  reasoning: ReasoningResult,
): BrainDecision {
  return {
    mode: INTENT_MODE_MAP[reasoning.analysis.primaryIntent],
    reason: reasoning.plan.strategy,
  };
}

function toStructuredReasoning(
  reasoning: ReasoningResult,
): BrainStructuredReasoning {
  const { analysis, plan, decision } = reasoning;

  return {
    analysis: {
      primaryIntent: analysis.primaryIntent,
      secondaryIntents: [...analysis.secondaryIntents],
      urgency: analysis.urgency,
      complexity: analysis.complexity,
      requiresClarification: analysis.requiresClarification,
      missingInformation: [...analysis.missingInformation],
    },
    plan: {
      strategy: plan.strategy,
      steps: plan.steps.map((step) => ({ ...step })),
      needsClarification: plan.needsClarification,
      clarificationQuestion: plan.clarificationQuestion,
    },
    responseDecision: { ...decision },
    guidance: reasoning.instructions,
  };
}

function decisionDurationStart(): number {
  return typeof performance !== "undefined"
    ? performance.now()
    : Date.now();
}

function recordDecisionDuration(startedAt: number): void {
  const finishedAt =
    typeof performance !== "undefined"
      ? performance.now()
      : Date.now();

  performanceMonitor.recordDecision(finishedAt - startedAt);
}

export class Brain {
  analyze(input: BrainInput): BrainResult {
    assertValidBrainInput(input);

    const context = buildBrainContext(input);
    const history = previousConversationHistory(
      input.history,
      context.message,
    );

    const reasoningStartedAt = decisionDurationStart();
    const reasoning = reasonAboutRequest(context.message, {
      context: context.userContext,
    });
    recordDecisionDuration(reasoningStartedAt);

    const decision = toBrainDecision(reasoning);
    const autonomy = assessAutonomy(context);

    if (!validateBrainResult(context, decision)) {
      throw new BrainValidationError([
        {
          code: "IAURA_BRAIN_RESULT_INVALID",
          field: "decision",
          message: "The cognitive decision failed validation.",
        },
      ]);
    }

    const compiledPrompt = promptBuilder.build({
      context,
      decision,
      autonomy,
      history,
      reasoning,
    });

    const structuredContext: BrainStructuredContext = {
      userContext: context.userContext,
      conversationHistory: history,
      createdAt: context.createdAt,
      decision,
      autonomy,
      reasoning: toStructuredReasoning(reasoning),
    };

    const cognitiveRequest: CognitiveRequest = {
      originalUserMessage: context.message,
      structuredContext,
      compiledPrompt,
      ...(input.conversationIdentity?.projectId
        ? { projectId: input.conversationIdentity.projectId }
        : {}),
    };

    assertValidCognitiveRequest(cognitiveRequest);

    const result: BrainResult = {
      ...cognitiveRequest,
      context,
      decision,
      autonomy,
      prompt: compiledPrompt,
      validated: true,
    };

    assertValidBrainResult(result);

    return result;
  }
}

export const iauraBrain = new Brain();
