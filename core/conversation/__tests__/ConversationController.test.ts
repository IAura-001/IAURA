import {
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from "vitest";

const mocks = vi.hoisted(() => ({
  analyze: vi.fn(),
  generateCognitiveResponse: vi.fn(),
  executeMemoryUpdates: vi.fn(),
}));

vi.mock("@/core/brain", () => ({
  iauraBrain: {
    analyze: mocks.analyze,
  },
}));

vi.mock("@/services/cognitive", () => ({
  generateCognitiveResponse:
    mocks.generateCognitiveResponse,
}));

vi.mock("@/core/memory", () => ({
  executeMemoryUpdates:
    mocks.executeMemoryUpdates,
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

const memoryUpdates = [
  {
    operation: "remember" as const,
    type: "preference" as const,
    content: "Prefers concise execution instructions.",
    tags: [
      "communication",
      "execution",
    ],
    reason:
      "This preference will improve future collaboration.",
    confidence: 0.96,
  },
];

describe("ConversationController", () => {
  beforeEach(() => {
    conversationMemory.clear();

    mocks.analyze.mockReset();
    mocks.generateCognitiveResponse.mockReset();
    mocks.executeMemoryUpdates.mockReset();

    mocks.executeMemoryUpdates.mockReturnValue({
      items: [],
      remembered: [],
    });
  });

  it("stops before provider and memory execution while preserving the user message when Brain validation fails", async () => {
    conversationMemory.add(
      "assistant",
      "Existing history.",
    );

    const initialHistory =
      conversationMemory.getHistory();

    mocks.analyze.mockImplementation(() => {
      throw new BrainValidationError([
        {
          code: "IAURA_BRAIN_MESSAGE_REQUIRED",
          field: "message",
          message: "A message is required.",
        },
      ]);
    });

    const controller =
      new ConversationController();

    await expect(
      controller.send(
        "invalid",
        "Project context",
      ),
    ).rejects.toMatchObject({
      name: "BrainValidationError",
      disposition: "stop",
    });

    expect(
      mocks.analyze,
    ).toHaveBeenCalledWith(
      expect.objectContaining({
        message: "invalid",
        userContext: "Project context",
        history: initialHistory,
        conversationIdentity:
          expect.objectContaining({
            conversationId:
              expect.any(String),
          }),
      }),
    );

    expect(
      mocks.generateCognitiveResponse,
    ).not.toHaveBeenCalled();

    expect(
      mocks.executeMemoryUpdates,
    ).not.toHaveBeenCalled();

    expect(
      conversationMemory.getHistory(),
    ).toEqual([
      ...initialHistory,
      {
        role: "user",
        content: "invalid",
      },
    ]);
  });

  it("sends Brain's separated contract to the provider and executes its memory proposals", async () => {
    mocks.analyze.mockReturnValue(
      cognitiveRequest,
    );

    mocks.generateCognitiveResponse.mockResolvedValue({
      content:
        "Use the approved direction.",
      actions: [],
      memoryUpdates,
      experience: {
        kind: "general",
        title: "",
        summary: "",
        phases: [],
        choices: [],
        recommendedSurface: "none",
      },
    });

    const controller =
      new ConversationController();

    await controller.send(
      "Plan the next step.",
      "Project context",
    );

    expect(
      mocks.generateCognitiveResponse,
    ).toHaveBeenCalledWith(
      cognitiveRequest,
    );

    expect(
      mocks.executeMemoryUpdates,
    ).toHaveBeenCalledTimes(1);

    expect(
      mocks.executeMemoryUpdates,
    ).toHaveBeenCalledWith(
      memoryUpdates,
    );

    expect(
      conversationMemory.getHistory(),
    ).toEqual([
      {
        role: "user",
        content:
          "Plan the next step.",
      },
      {
        role: "assistant",
        content:
          "Use the approved direction.",
      },
    ]);
  });

  it("executes an empty memory proposal list safely", async () => {
    mocks.analyze.mockReturnValue(
      cognitiveRequest,
    );

    mocks.generateCognitiveResponse.mockResolvedValue({
      content:
        "No durable memory is needed.",
      actions: [],
      memoryUpdates: [],
      experience: {
        kind: "general",
        title: "",
        summary: "",
        phases: [],
        choices: [],
        recommendedSurface: "none",
      },
    });

    const controller =
      new ConversationController();

    await controller.send(
      "Explain this temporary error.",
      "Project context",
    );

    expect(
      mocks.executeMemoryUpdates,
    ).toHaveBeenCalledWith([]);

    expect(
      conversationMemory.getHistory(),
    ).toEqual([
      {
        role: "user",
        content:
          "Explain this temporary error.",
      },
      {
        role: "assistant",
        content:
          "No durable memory is needed.",
      },
    ]);
  });
});