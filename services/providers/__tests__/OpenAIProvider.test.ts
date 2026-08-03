import {
  afterEach,
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from "vitest";

import { IAURA_RESPONSE_SCHEMA } from "@/core/actions";
import type {
  BrainResult,
  CognitiveRequest,
} from "@/core/brain";
import type { AIRequest } from "@/core/providers";

const mocks = vi.hoisted(() => ({
  createResponse: vi.fn(),
  brainAnalyze: vi.fn(),
}));

vi.mock("openai", () => ({
  default: class OpenAIMock {
    responses = {
      create: mocks.createResponse,
    };
  },
}));

vi.mock("@/core/brain", () => ({
  iauraBrain: {
    analyze: mocks.brainAnalyze,
  },
}));

import { OpenAIProvider } from "../OpenAIProvider";

const cognitiveRequest: CognitiveRequest = {
  originalUserMessage: "  Preserve this message exactly.  ",
  structuredContext: {
    userContext: "Preferred language: English",
    conversationHistory: [
      {
        role: "user",
        content: "Previous user turn.",
      },
      {
        role: "assistant",
        content: "Previous assistant turn.",
      },
    ],
    createdAt: "2026-08-02T12:00:00.000Z",
    decision: {
      mode: "planner",
      reason: "The request needs an ordered response.",
    },
    autonomy: {
      mode: "supervised",
      defaultAction: "proceed",
      potentialHumanGates: [],
      reason: "The response is safe and reversible.",
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
        strategy: "Create an ordered response.",
        steps: [
          {
            id: "respond",
            title: "Respond",
            purpose: "Deliver the useful result.",
          },
        ],
        needsClarification: false,
      },
      responseDecision: {
        depth: "brief",
        format: "strategy",
        shouldAskQuestion: false,
        shouldRecommendAction: true,
        shouldUseSections: true,
        maximumSuggestedSteps: 3,
      },
      guidance: "Keep the response focused.",
    },
  },
  compiledPrompt: "The one compiled IAURA prompt.",
};

const assistantPlan = {
  content: "The response is ready.",
  actions: [],
  experience: {
    kind: "general",
    title: "Result",
    summary: "A focused response.",
    phases: [],
    choices: [],
    recommendedSurface: "none",
  },
};

function brainResult(): BrainResult {
  return {
    ...cognitiveRequest,
    originalUserMessage: "Legacy request",
    context: {
      message: "Legacy request",
      userContext: cognitiveRequest.structuredContext.userContext,
      createdAt: cognitiveRequest.structuredContext.createdAt,
    },
    decision: cognitiveRequest.structuredContext.decision,
    autonomy: cognitiveRequest.structuredContext.autonomy,
    prompt: cognitiveRequest.compiledPrompt,
    validated: true,
  };
}

describe("OpenAIProvider", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  beforeEach(() => {
    mocks.createResponse.mockReset();
    mocks.brainAnalyze.mockReset();
    mocks.createResponse.mockResolvedValue({
      output_text: JSON.stringify(assistantPlan),
    });
  });

  it("keeps compiled instructions, context, history and original message separate", async () => {
    const provider = new OpenAIProvider({
      apiKey: "test-key",
      model: "test-model",
    });

    const result = await provider.generate(cognitiveRequest);
    const body = mocks.createResponse.mock.calls[0][0];

    expect(body.instructions).toBe(
      cognitiveRequest.compiledPrompt,
    );
    expect(body.input).toHaveLength(4);

    const contextMessage = body.input[0];
    expect(contextMessage.role).toBe("user");
    const parsedContext = JSON.parse(
      contextMessage.content,
    ) as Record<string, unknown>;
    expect(parsedContext).toMatchObject({
      userContext: "Preferred language: English",
      decision: cognitiveRequest.structuredContext.decision,
    });
    expect(parsedContext).not.toHaveProperty(
      "conversationHistory",
    );

    expect(body.input.slice(1, 3)).toEqual(
      cognitiveRequest.structuredContext.conversationHistory,
    );
    expect(body.input.at(-1)).toEqual({
      role: "user",
      content: cognitiveRequest.originalUserMessage,
    });
    expect(body.text).toEqual({
      verbosity: "medium",
      format: {
        type: "json_schema",
        name: "iaura_action_plan",
        description:
          "IAURA response plus safe local actions.",
        strict: true,
        schema: IAURA_RESPONSE_SCHEMA,
      },
    });
    expect(mocks.brainAnalyze).not.toHaveBeenCalled();
    expect(result).toMatchObject({
      content: assistantPlan.content,
      provider: "openai",
      model: "test-model",
    });
  });

  it("adapts direct legacy provider callers through Brain", async () => {
    mocks.brainAnalyze.mockReturnValue(brainResult());
    const provider = new OpenAIProvider({
      apiKey: "test-key",
      model: "test-model",
    });

    await provider.generate({
      prompt: "Legacy request",
      instructions: "Existing context",
    });

    expect(mocks.brainAnalyze).toHaveBeenCalledWith({
      message: "Legacy request",
      userContext: "Existing context",
    });
    expect(
      mocks.createResponse.mock.calls[0][0].input.at(-1),
    ).toEqual({
      role: "user",
      content: "Legacy request",
    });
  });

  it("stops an invalid cognitive request before calling OpenAI", async () => {
    const provider = new OpenAIProvider({
      apiKey: "test-key",
      model: "test-model",
    });
    const invalidRequest = {
      ...cognitiveRequest,
      compiledPrompt: "",
    } as AIRequest;

    await expect(
      provider.generate(invalidRequest),
    ).rejects.toMatchObject({
      name: "BrainValidationError",
      disposition: "stop",
    });
    expect(mocks.createResponse).not.toHaveBeenCalled();
  });

  it("does not include provider response bodies in error logs", async () => {
    const errorLog = vi
      .spyOn(console, "error")
      .mockImplementation(() => undefined);
    mocks.createResponse.mockRejectedValue({
      name: "ProviderError",
      message: "Request failed",
      status: 500,
      code: "provider_error",
      type: "server_error",
      response: {
        data: "private-provider-body",
      },
    });
    const provider = new OpenAIProvider({
      apiKey: "test-key",
      model: "test-model",
    });

    await expect(
      provider.generate(cognitiveRequest),
    ).rejects.toBeDefined();

    expect(JSON.stringify(errorLog.mock.calls)).not.toContain(
      "private-provider-body",
    );
  });
});
