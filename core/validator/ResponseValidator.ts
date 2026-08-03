import type {
  BrainContext,
  BrainDecision,
  BrainInput,
  BrainResult,
  CognitiveRequest,
  ThinkingMode,
} from "../brain/types";

export type BrainValidationDisposition = "stop";

export type BrainValidationIssueCode =
  | "IAURA_BRAIN_INPUT_INVALID"
  | "IAURA_BRAIN_MESSAGE_REQUIRED"
  | "IAURA_BRAIN_CONTEXT_INVALID"
  | "IAURA_BRAIN_DECISION_INVALID"
  | "IAURA_COGNITIVE_REQUEST_INVALID"
  | "IAURA_COGNITIVE_PROMPT_REQUIRED"
  | "IAURA_BRAIN_RESULT_INVALID";

export interface BrainValidationIssue {
  code: BrainValidationIssueCode;
  field: string;
  message: string;
}

export class BrainValidationError extends Error {
  readonly disposition: BrainValidationDisposition = "stop";
  readonly code: BrainValidationIssueCode;
  readonly issues: readonly BrainValidationIssue[];

  constructor(issues: readonly BrainValidationIssue[]) {
    const normalizedIssues =
      issues.length > 0
        ? [...issues]
        : [
            {
              code: "IAURA_BRAIN_RESULT_INVALID" as const,
              field: "brainResult",
              message: "The cognitive result is invalid.",
            },
          ];

    super(normalizedIssues.map((issue) => issue.message).join(" "));
    this.name = "BrainValidationError";
    this.code = normalizedIssues[0].code;
    this.issues = normalizedIssues;
  }
}

const THINKING_MODES = new Set<ThinkingMode>([
  "mentor",
  "planner",
  "analyst",
  "executor",
  "creative",
  "coach",
]);

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function isNonEmptyString(value: unknown): value is string {
  return typeof value === "string" && value.trim().length > 0;
}

function isConversationHistory(value: unknown): boolean {
  return (
    Array.isArray(value) &&
    value.every(
      (message) =>
        isRecord(message) &&
        (message.role === "user" || message.role === "assistant") &&
        isNonEmptyString(message.content),
    )
  );
}

function decisionIssues(
  decision: unknown,
  field = "decision",
): BrainValidationIssue[] {
  if (!isRecord(decision)) {
    return [
      {
        code: "IAURA_BRAIN_DECISION_INVALID",
        field,
        message: "The cognitive decision is missing or invalid.",
      },
    ];
  }

  const issues: BrainValidationIssue[] = [];

  if (
    typeof decision.mode !== "string" ||
    !THINKING_MODES.has(decision.mode as ThinkingMode)
  ) {
    issues.push({
      code: "IAURA_BRAIN_DECISION_INVALID",
      field: `${field}.mode`,
      message: "The cognitive decision mode is invalid.",
    });
  }

  if (!isNonEmptyString(decision.reason)) {
    issues.push({
      code: "IAURA_BRAIN_DECISION_INVALID",
      field: `${field}.reason`,
      message: "The cognitive decision requires a reason.",
    });
  }

  return issues;
}

function structuredContextIssues(
  context: unknown,
): BrainValidationIssue[] {
  if (!isRecord(context)) {
    return [
      {
        code: "IAURA_BRAIN_CONTEXT_INVALID",
        field: "structuredContext",
        message: "The structured cognitive context is missing.",
      },
    ];
  }

  const issues: BrainValidationIssue[] = [];

  if (!isNonEmptyString(context.userContext)) {
    issues.push({
      code: "IAURA_BRAIN_CONTEXT_INVALID",
      field: "structuredContext.userContext",
      message: "The structured cognitive context requires user context.",
    });
  }

  if (!isConversationHistory(context.conversationHistory)) {
    issues.push({
      code: "IAURA_BRAIN_CONTEXT_INVALID",
      field: "structuredContext.conversationHistory",
      message: "The conversation history is invalid.",
    });
  }

  if (
    !isNonEmptyString(context.createdAt) ||
    !Number.isFinite(Date.parse(context.createdAt))
  ) {
    issues.push({
      code: "IAURA_BRAIN_CONTEXT_INVALID",
      field: "structuredContext.createdAt",
      message: "The structured cognitive context requires a valid timestamp.",
    });
  }

  issues.push(...decisionIssues(context.decision, "structuredContext.decision"));

  if (
    !isRecord(context.autonomy) ||
    context.autonomy.mode !== "supervised" ||
    context.autonomy.defaultAction !== "proceed" ||
    !Array.isArray(context.autonomy.potentialHumanGates) ||
    !isNonEmptyString(context.autonomy.reason)
  ) {
    issues.push({
      code: "IAURA_BRAIN_CONTEXT_INVALID",
      field: "structuredContext.autonomy",
      message: "The autonomy assessment is invalid.",
    });
  }

  if (!isRecord(context.reasoning)) {
    issues.push({
      code: "IAURA_BRAIN_CONTEXT_INVALID",
      field: "structuredContext.reasoning",
      message: "The structured reasoning context is missing.",
    });
  } else {
    const analysis = context.reasoning.analysis;

    if (
      !isRecord(analysis) ||
      !isNonEmptyString(analysis.primaryIntent) ||
      !Array.isArray(analysis.secondaryIntents) ||
      !isNonEmptyString(analysis.urgency) ||
      !isNonEmptyString(analysis.complexity) ||
      typeof analysis.requiresClarification !== "boolean" ||
      !Array.isArray(analysis.missingInformation) ||
      "originalInput" in analysis ||
      "normalizedInput" in analysis ||
      "relevantContext" in analysis ||
      "objective" in analysis
    ) {
      issues.push({
        code: "IAURA_BRAIN_CONTEXT_INVALID",
        field: "structuredContext.reasoning.analysis",
        message: "The structured reasoning analysis is invalid.",
      });
    }

    if (
      !isRecord(context.reasoning.plan) ||
      "objective" in context.reasoning.plan
    ) {
      issues.push({
        code: "IAURA_BRAIN_CONTEXT_INVALID",
        field: "structuredContext.reasoning.plan",
        message: "The structured reasoning plan is invalid.",
      });
    }

    if (!isRecord(context.reasoning.responseDecision)) {
      issues.push({
        code: "IAURA_BRAIN_CONTEXT_INVALID",
        field: "structuredContext.reasoning.responseDecision",
        message: "The structured response decision is invalid.",
      });
    }

    if (!isNonEmptyString(context.reasoning.guidance)) {
      issues.push({
        code: "IAURA_BRAIN_CONTEXT_INVALID",
        field: "structuredContext.reasoning.guidance",
        message: "The structured reasoning guidance is missing.",
      });
    }
  }

  return issues;
}

function cognitiveRequestIssues(
  request: unknown,
): BrainValidationIssue[] {
  if (!isRecord(request)) {
    return [
      {
        code: "IAURA_COGNITIVE_REQUEST_INVALID",
        field: "cognitiveRequest",
        message: "The cognitive request is missing or invalid.",
      },
    ];
  }

  const issues: BrainValidationIssue[] = [];

  if (!isNonEmptyString(request.originalUserMessage)) {
    issues.push({
      code: "IAURA_BRAIN_MESSAGE_REQUIRED",
      field: "originalUserMessage",
      message: "A non-empty original user message is required.",
    });
  }

  if (!isNonEmptyString(request.compiledPrompt)) {
    issues.push({
      code: "IAURA_COGNITIVE_PROMPT_REQUIRED",
      field: "compiledPrompt",
      message: "A non-empty compiled cognitive prompt is required.",
    });
  }

  issues.push(...structuredContextIssues(request.structuredContext));

  return issues;
}

export function validateBrainResult(
  context: BrainContext,
  decision: BrainDecision,
): boolean {
  return (
    isNonEmptyString(context.message) &&
    isNonEmptyString(context.userContext) &&
    isNonEmptyString(context.createdAt) &&
    Number.isFinite(Date.parse(context.createdAt)) &&
    decisionIssues(decision).length === 0
  );
}

export function assertValidBrainInput(
  input: unknown,
): asserts input is BrainInput {
  if (!isRecord(input)) {
    throw new BrainValidationError([
      {
        code: "IAURA_BRAIN_INPUT_INVALID",
        field: "input",
        message: "The cognitive input is missing or invalid.",
      },
    ]);
  }

  const issues: BrainValidationIssue[] = [];

  if (!isNonEmptyString(input.message)) {
    issues.push({
      code: "IAURA_BRAIN_MESSAGE_REQUIRED",
      field: "message",
      message: "A non-empty user message is required.",
    });
  }

  if (
    input.userContext !== undefined &&
    typeof input.userContext !== "string"
  ) {
    issues.push({
      code: "IAURA_BRAIN_INPUT_INVALID",
      field: "userContext",
      message: "User context must be a string when provided.",
    });
  }

  if (
    input.history !== undefined &&
    !isConversationHistory(input.history)
  ) {
    issues.push({
      code: "IAURA_BRAIN_INPUT_INVALID",
      field: "history",
      message: "Conversation history is invalid.",
    });
  }

  if (issues.length > 0) {
    throw new BrainValidationError(issues);
  }
}

export function assertValidCognitiveRequest(
  request: unknown,
): asserts request is CognitiveRequest {
  const issues = cognitiveRequestIssues(request);

  if (issues.length > 0) {
    throw new BrainValidationError(issues);
  }
}

export function assertValidBrainResult(
  result: unknown,
): asserts result is BrainResult {
  const issues = cognitiveRequestIssues(result);

  if (!isRecord(result)) {
    throw new BrainValidationError(issues);
  }

  if (
    !isRecord(result.context) ||
    !isNonEmptyString(result.context.message) ||
    !isNonEmptyString(result.context.userContext) ||
    !isNonEmptyString(result.context.createdAt)
  ) {
    issues.push({
      code: "IAURA_BRAIN_RESULT_INVALID",
      field: "context",
      message: "The cognitive result context is invalid.",
    });
  }

  issues.push(...decisionIssues(result.decision));

  if (!isRecord(result.autonomy)) {
    issues.push({
      code: "IAURA_BRAIN_RESULT_INVALID",
      field: "autonomy",
      message: "The cognitive result autonomy assessment is invalid.",
    });
  }

  if (
    !isNonEmptyString(result.prompt) ||
    result.prompt !== result.compiledPrompt
  ) {
    issues.push({
      code: "IAURA_BRAIN_RESULT_INVALID",
      field: "prompt",
      message: "The compatibility prompt must match the compiled prompt.",
    });
  }

  if (result.validated !== true) {
    issues.push({
      code: "IAURA_BRAIN_RESULT_INVALID",
      field: "validated",
      message: "The cognitive result was not validated.",
    });
  }

  if (
    isRecord(result.context) &&
    isNonEmptyString(result.context.message) &&
    result.originalUserMessage !== result.context.message
  ) {
    issues.push({
      code: "IAURA_BRAIN_RESULT_INVALID",
      field: "originalUserMessage",
      message: "The original user message does not match the brain context.",
    });
  }

  if (issues.length > 0) {
    throw new BrainValidationError(issues);
  }
}
