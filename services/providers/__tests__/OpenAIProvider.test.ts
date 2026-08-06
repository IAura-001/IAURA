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
  CognitiveRequest,
} from "@/core/brain";

const mocks = vi.hoisted(() => ({
  createResponse: vi.fn(),
}));

vi.mock("openai", () => ({
  default: class OpenAIMock {
    responses = {
      create: mocks.createResponse,
    };
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

describe("OpenAIProvider", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  beforeEach(() => {
    mocks.createResponse.mockReset();

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

    expect(result).toMatchObject({
      content: assistantPlan.content,
      provider: "openai",
      model: "test-model",
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
    } as unknown as CognitiveRequest;

    await expect(
      provider.generate(invalidRequest),
    ).rejects.toMatchObject({
      name: "BrainValidationError",
      disposition: "stop",
    });

    expect(
      mocks.createResponse,
    ).not.toHaveBeenCalled();
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

    expect(
      JSON.stringify(errorLog.mock.calls),
    ).not.toContain(
      "private-provider-body",
    );
  });
});