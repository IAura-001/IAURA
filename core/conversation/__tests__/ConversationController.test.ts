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
  BrainValidationError,
} from "@/core/validator/ResponseValidator";
import { conversationMemory } from "../ConversationMemory";
import { ConversationController } from "../ConversationController";

const cognitiveRequest = {
  originalUserMessage: "Plan the next step.",
  structuredContext: {
    userContext: "Project context",
    conversationHistory: [],
    createdAt: "2026-08-02T12:00:00.000Z",
    decision: {
      mode: "planner" as const,
      reason: "Planning is required.",
    },
    autonomy: {
      mode: "supervised" as const,
      defaultAction: "proceed" as const,
      potentialHumanGates: [],
      reason: "The operation is reversible.",
    },
    reasoning: {
      analysis: {
        primaryIntent: "plan" as const,
        secondaryIntents: [],
        urgency: "low" as const,
        complexity: "simple" as const,
        requiresClarification: false,
        missingInformation: [],
      },
      plan: {
        strategy: "Sequence the next step.",
        steps: [],
        needsClarification: false,
      },
      responseDecision: {
        depth: "brief" as const,
        format: "strategy" as const,
        shouldAskQuestion: false,
        shouldRecommendAction: true,
        shouldUseSections: false,
        maximumSuggestedSteps: 3,
      },
      guidance: "Return the next step.",
    },
  },
  compiledPrompt: "Canonical IAURA prompt.",
};

describe("ConversationController", () => {
  beforeEach(() => {
    conversationMemory.clear();
    mocks.analyze.mockReset();
    mocks.generateOpenAIResponse.mockReset();
  });

  it("stops before provider execution and memory mutation when Brain validation fails", async () => {
    conversationMemory.add("assistant", "Existing history.");
    const initialHistory = conversationMemory.getHistory();
    mocks.analyze.mockImplementation(() => {
      throw new BrainValidationError([
        {
          code: "IAURA_BRAIN_MESSAGE_REQUIRED",
          field: "message",
          message: "A message is required.",
        },
      ]);
    });

    const controller = new ConversationController();

    await expect(
      controller.send("invalid", "Project context"),
    ).rejects.toMatchObject({
      name: "BrainValidationError",
      disposition: "stop",
    });

    expect(mocks.analyze).toHaveBeenCalledWith({
      message: "invalid",
      userContext: "Project context",
      history: initialHistory,
    });
    expect(mocks.generateOpenAIResponse).not.toHaveBeenCalled();
    expect(conversationMemory.getHistory()).toEqual(
      initialHistory,
    );
  });

  it("sends only Brain's separated contract to the provider", async () => {
    mocks.analyze.mockReturnValue(cognitiveRequest);
    mocks.generateOpenAIResponse.mockResolvedValue({
      content: "Use the approved direction.",
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

    const controller = new ConversationController();
    await controller.send(
      "Plan the next step.",
      "Project context",
    );

    expect(mocks.generateOpenAIResponse).toHaveBeenCalledWith(
      cognitiveRequest,
    );
    expect(conversationMemory.getHistory()).toEqual([
      { role: "user", content: "Plan the next step." },
      {
        role: "assistant",
        content: "Use the approved direction.",
      },
    ]);
  });
});
