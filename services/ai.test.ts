import {
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from "vitest";

const mocks = vi.hoisted(() => ({
  analyze: vi.fn(),
  generateOpenAIResponse: vi.fn(),
}));

vi.mock("@/core/brain", () => ({
  iauraBrain: {
    analyze: mocks.analyze,
  },
}));

vi.mock("@/services/openai", () => ({
  generateOpenAIResponse:
    mocks.generateOpenAIResponse,
}));

import {
  generateAIResponse,
  sanitizeAuraResponse,
} from "./ai";

const structuredContext = {
  userContext: "Profile context\n\nProject memory",
  conversationHistory: [],
  createdAt: "2026-08-02T00:00:00.000Z",
  decision: {
    mode: "analyst" as const,
    reason: "Analyze the current state.",
  },
  autonomy: {
    mode: "supervised" as const,
    defaultAction: "proceed" as const,
    potentialHumanGates: [],
    reason: "Safe to continue.",
  },
  reasoning: {
    analysis: {
      primaryIntent: "evaluate" as const,
      secondaryIntents: [],
      urgency: "low" as const,
      complexity: "simple" as const,
      objective: "Review the current state.",
      requiresClarification: false,
      missingInformation: [],
    },
    plan: {
      objective: "Review the current state.",
      strategy: "Review the available evidence.",
      steps: [],
      needsClarification: false,
    },
    responseDecision: {
      depth: "brief" as const,
      format: "comparison" as const,
      shouldAskQuestion: false,
      shouldRecommendAction: true,
      shouldUseSections: false,
      maximumSuggestedSteps: 3,
    },
    guidance: "Use a concise comparison.",
  },
};

describe("generateAIResponse", () => {
  beforeEach(() => {
    mocks.analyze.mockReset();
    mocks.generateOpenAIResponse.mockReset();

    mocks.analyze.mockReturnValue({
      originalUserMessage: "Review the current state.",
      structuredContext,
      compiledPrompt: "Canonical IAURA prompt",
    });
    mocks.generateOpenAIResponse.mockResolvedValue({
      content: "**Clear** result",
      actions: [],
      experience: {
        kind: "general",
        title: "",
        summary: "",
        phases: [],
        choices: [],
        recommendedSurface: "none",
      },
    });
  });

  it("routes legacy string callers through Brain and the separated contract", async () => {
    await expect(
      generateAIResponse(
        "  Review the current state.  ",
        "Profile context",
      ),
    ).resolves.toBe("Clear result");

    expect(mocks.analyze).toHaveBeenCalledWith({
      message: "Review the current state.",
      userContext: "Profile context",
    });
    expect(mocks.generateOpenAIResponse).toHaveBeenCalledWith({
      originalUserMessage: "Review the current state.",
      structuredContext,
      compiledPrompt: "Canonical IAURA prompt",
    });
  });

  it("stops before Brain when the prompt is empty", async () => {
    await expect(generateAIResponse("   ")).rejects.toThrow(
      "IAURA requires a non-empty prompt.",
    );

    expect(mocks.analyze).not.toHaveBeenCalled();
    expect(mocks.generateOpenAIResponse).not.toHaveBeenCalled();
  });
});

describe("sanitizeAuraResponse", () => {
  it("preserves the existing plain-text cleanup contract", () => {
    expect(sanitizeAuraResponse("## Title\n\n**Result**"))
      .toBe("Title\n\nResult");
  });
});
