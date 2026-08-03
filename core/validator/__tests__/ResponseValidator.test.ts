import { describe, expect, it } from "vitest";

import type {
  BrainContext,
  BrainDecision,
  CognitiveRequest,
} from "@/core/brain";
import {
  assertValidBrainInput,
  assertValidBrainResult,
  assertValidCognitiveRequest,
  BrainValidationError,
  validateBrainResult,
} from "../ResponseValidator";

const context: BrainContext = {
  message: "Organiza el siguiente paso.",
  userContext: "Preferred Language: Spanish",
  createdAt: "2026-08-02T12:00:00.000Z",
};

const decision: BrainDecision = {
  mode: "planner",
  reason: "The request requires an actionable sequence.",
};

function cognitiveRequest(): CognitiveRequest {
  return {
    originalUserMessage: context.message,
    compiledPrompt: "Official IAURA cognitive protocol.",
    structuredContext: {
      userContext: context.userContext,
      conversationHistory: [],
      createdAt: context.createdAt,
      decision,
      autonomy: {
        mode: "supervised",
        defaultAction: "proceed",
        potentialHumanGates: [],
        reason: "Continue with safe work.",
      },
      reasoning: {
        analysis: {
          primaryIntent: "plan",
          secondaryIntents: [],
          urgency: "low",
          complexity: "simple",
          requiresClarification: false,
          missingInformation: [],
        },
        plan: {
          strategy: "Organize the work into a clear sequence.",
          steps: [],
          needsClarification: false,
        },
        responseDecision: {
          depth: "brief",
          format: "strategy",
          shouldAskQuestion: false,
          shouldRecommendAction: true,
          shouldUseSections: false,
          maximumSuggestedSteps: 3,
        },
        guidance: "Return a concise and actionable response.",
      },
    },
  };
}

describe("ResponseValidator", () => {
  it("preserves the legacy boolean validation contract", () => {
    expect(validateBrainResult(context, decision)).toBe(true);
    expect(
      validateBrainResult(
        {
          ...context,
          message: " ",
        },
        decision,
      ),
    ).toBe(false);
  });

  it("stops an invalid input with an actionable error", () => {
    let validationError: BrainValidationError | null = null;

    try {
      assertValidBrainInput({ message: " " });
    } catch (error) {
      if (error instanceof BrainValidationError) {
        validationError = error;
      }
    }

    expect(validationError).not.toBeNull();
    expect(validationError?.disposition).toBe("stop");
    expect(validationError?.code).toBe("IAURA_BRAIN_MESSAGE_REQUIRED");
  });

  it("accepts a complete separated cognitive request", () => {
    const request = cognitiveRequest();

    expect(() => assertValidCognitiveRequest(request)).not.toThrow();
  });

  it("stops a cognitive request without a compiled prompt", () => {
    const request = {
      ...cognitiveRequest(),
      compiledPrompt: " ",
    };

    expect(() => assertValidCognitiveRequest(request)).toThrowError(
      expect.objectContaining({
        disposition: "stop",
        code: "IAURA_COGNITIVE_PROMPT_REQUIRED",
      }),
    );
  });

  it("rejects reasoning context that leaks the original objective", () => {
    const request = cognitiveRequest() as CognitiveRequest & {
      structuredContext: CognitiveRequest["structuredContext"] & {
        reasoning: CognitiveRequest["structuredContext"]["reasoning"] & {
          analysis: Record<string, unknown>;
        };
      };
    };

    request.structuredContext.reasoning.analysis.objective = context.message;

    expect(() => assertValidCognitiveRequest(request)).toThrow(
      BrainValidationError,
    );
  });

  it("rejects an unvalidated or inconsistent final result", () => {
    const request = cognitiveRequest();
    const invalidResult = {
      ...request,
      context,
      decision,
      autonomy: request.structuredContext.autonomy,
      prompt: "A different prompt.",
      validated: false,
    };

    expect(() => assertValidBrainResult(invalidResult)).toThrow(
      BrainValidationError,
    );
  });
});
