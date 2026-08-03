import { beforeEach, describe, expect, it } from "vitest";

import { performanceMonitor } from "@/core/performance";
import { BrainValidationError } from "@/core/validator/ResponseValidator";
import { Brain } from "../Brain";

describe("Brain", () => {
  beforeEach(() => {
    performanceMonitor.reset();
  });

  it("is the single orchestrator for a separated cognitive request", () => {
    const originalUserMessage =
      "Necesito un plan para lanzar el proyecto Aurora Delta 947.";
    const brain = new Brain();

    const result = brain.analyze({
      message: originalUserMessage,
      userContext: "Preferred Language: Spanish",
      history: [
        {
          role: "assistant",
          content: "Definimos el objetivo principal.",
        },
        {
          role: "user",
          content: originalUserMessage,
        },
      ],
    });

    expect(result.originalUserMessage).toBe(originalUserMessage);
    expect(result.compiledPrompt).toBe(result.prompt);
    expect(result.validated).toBe(true);
    expect(result.decision.mode).toBe("planner");
    expect(result.structuredContext.conversationHistory).toEqual([
      {
        role: "assistant",
        content: "Definimos el objetivo principal.",
      },
    ]);
    expect(result.compiledPrompt).not.toContain(originalUserMessage);
    expect(result.structuredContext.reasoning.guidance).not.toContain(
      originalUserMessage,
    );
    expect(result.structuredContext.reasoning.analysis).not.toHaveProperty(
      "originalInput",
    );
    expect(result.structuredContext.reasoning.analysis).not.toHaveProperty(
      "normalizedInput",
    );
    expect(result.structuredContext.reasoning.analysis).not.toHaveProperty(
      "relevantContext",
    );
    expect(result.structuredContext.reasoning.analysis).not.toHaveProperty(
      "objective",
    );
    expect(result.structuredContext.reasoning.plan).not.toHaveProperty(
      "objective",
    );
    expect(performanceMonitor.getSnapshot().decisionSamples).toBe(1);
  });

  it("stops before reasoning and prompt compilation when input is invalid", () => {
    const brain = new Brain();

    expect(() =>
      brain.analyze({
        message: "   ",
        userContext: "Preferred Language: Spanish",
      }),
    ).toThrow(BrainValidationError);

    expect(performanceMonitor.getSnapshot().decisionSamples).toBe(0);
  });

  it("maps the unified reasoning taxonomy to the legacy decision mode", () => {
    const result = new Brain().analyze({
      message: "Quiero crear una identidad visual sobria para este proyecto.",
      userContext: "Preferred Language: Spanish",
    });

    expect(result.structuredContext.reasoning.analysis.primaryIntent).toBe(
      "create",
    );
    expect(result.decision.mode).toBe("creative");
  });
});
