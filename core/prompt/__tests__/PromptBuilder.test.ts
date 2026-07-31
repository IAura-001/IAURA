import { describe, expect, it } from "vitest";
import { PromptBuilder } from "../PromptBuilder";

const input = {
  context: {
    message: "Corrige el proyecto y comprueba el resultado.",
    userContext: "The user is building IAURA.",
    createdAt: "2026-07-30T00:00:00.000Z",
  },
  decision: {
    mode: "executor" as const,
    reason: "The request is actionable.",
  },
  autonomy: {
    mode: "supervised" as const,
    defaultAction: "proceed" as const,
    potentialHumanGates: [],
    reason: "Continue with safe work.",
  },
};

describe("PromptBuilder", () => {
  it("includes the supervised-autonomy policy", () => {
    const prompt = new PromptBuilder().build(input);

    expect(prompt).toContain(
      "Your default action is to proceed."
    );
    expect(prompt).toContain(
      "If the user has already made the decision or explicitly authorized the action, do not ask again."
    );
    expect(prompt).toContain(
      "Potential human gates: none detected"
    );
  });

  it("includes the current message only once", () => {
    const prompt = new PromptBuilder().build(input);
    const occurrences = prompt
      .split(input.context.message)
      .length - 1;

    expect(occurrences).toBe(1);
  });
});
