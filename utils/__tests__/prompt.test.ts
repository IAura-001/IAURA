import { describe, expect, it } from "vitest";

import { buildPrompt } from "../prompt";

describe("buildPrompt", () => {
  it("keeps the legacy context argument without declaring a personality", () => {
    const context = "Goal: launch the current project.";
    const prompt = buildPrompt(context);

    expect(prompt).toContain("Current profile:");
    expect(prompt).toContain(context);
    expect(prompt).not.toContain("You are IAURA");
    expect(prompt).not.toContain("executive assistant");
  });

  it("omits the profile section when no context is supplied", () => {
    const prompt = buildPrompt();

    expect(prompt).not.toContain("Current profile:");
    expect(prompt).not.toContain("undefined");
    expect(prompt).toContain("Requested result:");
  });
});
