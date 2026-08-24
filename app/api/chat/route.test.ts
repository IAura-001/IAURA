import {
  afterEach,
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from "vitest";

import {
  BrainValidationError,
} from "@/core/validator/ResponseValidator";

const mocks = vi.hoisted(() => ({
  isRequestAuthorized: vi.fn(),
  getAuthenticatedUser: vi.fn(),
  brainAnalyze: vi.fn(),
  providerGenerate: vi.fn(),
  createProvider: vi.fn(),
  reserveUsage: vi.fn(),
}));

vi.mock("@/core/auth/access", () => ({
  isRequestAuthorized: mocks.isRequestAuthorized,
}));
vi.mock("@/core/auth/session", async () => {
  const { NextResponse } = await import("next/server");
  return {
    getAuthenticatedUser: mocks.getAuthenticatedUser,
    authenticationRequiredResponse: () => NextResponse.json(
      { error: "IAURA authentication required.", code: "IAURA_AUTH_REQUIRED" },
      { status: 401 },
    ),
  };
});

vi.mock("@/core/brain", () => ({
  iauraBrain: {
    analyze: mocks.brainAnalyze,
  },
}));

vi.mock("@/services/providers", () => ({
  createOpenAIProvider: mocks.createProvider,
}));
vi.mock("@/core/aiUsage/server", () => ({
  reserveAiUsage: mocks.reserveUsage,
  aiLimitResponse: () => new Response(null, { status: 429 }),
}));

import { POST } from "./route";
import { AiSafetyLimitError } from "@/core/aiUsage/types";

const cognitiveRequest = {
  originalUserMessage: "Help me plan the launch.",
  structuredContext: {
    userContext: "Preferred language: English",
    conversationHistory: [
      {
        role: "user" as const,
        content: "We already defined the audience.",
      },
      {
        role: "assistant" as const,
        content: "The audience is documented.",
      },
    ],
    createdAt: "2026-08-02T12:00:00.000Z",
    decision: {
      mode: "planner" as const,
      reason: "The request needs a sequence.",
    },
    autonomy: {
      mode: "supervised" as const,
      defaultAction: "proceed" as const,
      potentialHumanGates: [],
      reason: "Planning is safe and reversible.",
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
        strategy: "Sequence the work.",
        steps: [
          {
            id: "sequence",
            title: "Sequence",
            purpose: "Order the work.",
          },
        ],
        needsClarification: false,
      },
      responseDecision: {
        depth: "brief" as const,
        format: "strategy" as const,
        shouldAskQuestion: false,
        shouldRecommendAction: true,
        shouldUseSections: true,
        maximumSuggestedSteps: 3,
      },
      guidance: "Return a concise launch sequence.",
    },
  },
  compiledPrompt: "Official compiled IAURA prompt.",
};

const providerResult = {
  content: "Start with the announcement sequence.",
  actions: [],
  experience: {
    kind: "project",
    title: "Launch",
    summary: "A clear launch sequence.",
    phases: [],
    choices: [],
    recommendedSurface: "projects",
  },
  provider: "openai",
  model: "test-model",
};

function jsonRequest(body: string): Request {
  return new Request("https://vaeora.test/api/chat", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body,
  });
}

describe("POST /api/chat", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  beforeEach(() => {
    mocks.isRequestAuthorized.mockReset();
    mocks.brainAnalyze.mockReset();
    mocks.providerGenerate.mockReset();
    mocks.createProvider.mockReset();
    mocks.reserveUsage.mockReset().mockResolvedValue({ complete: vi.fn(), fail: vi.fn() });
    mocks.isRequestAuthorized.mockReturnValue(true);
    mocks.getAuthenticatedUser.mockResolvedValue({ id: "user-a" });
    mocks.providerGenerate.mockResolvedValue(providerResult);
    mocks.createProvider.mockReturnValue({
      generate: mocks.providerGenerate,
    });
  });

  it("requires private access before parsing the request", async () => {
    mocks.isRequestAuthorized.mockReturnValue(false);

    const response = await POST(
      jsonRequest("{invalid"),
    );

    expect(response.status).toBe(401);
    await expect(response.json()).resolves.toMatchObject({
      code: "IAURA_ACCESS_REQUIRED",
    });
    expect(mocks.createProvider).not.toHaveBeenCalled();
  });

  it("does not call OpenAI when the durable safety limit is reached", async () => {
    mocks.reserveUsage.mockRejectedValue(new AiSafetyLimitError(3600));
    const response = await POST(jsonRequest(JSON.stringify(cognitiveRequest)));
    expect(response.status).toBe(429);
    expect(mocks.createProvider).not.toHaveBeenCalled();
    expect(mocks.providerGenerate).not.toHaveBeenCalled();
  });

  it("requires a verified Supabase user after private access passes", async () => {
    mocks.getAuthenticatedUser.mockResolvedValue(null);

    const response = await POST(jsonRequest("{invalid"));

    expect(response.status).toBe(401);
    await expect(response.json()).resolves.toMatchObject({
      code: "IAURA_AUTH_REQUIRED",
    });
    expect(mocks.brainAnalyze).not.toHaveBeenCalled();
    expect(mocks.createProvider).not.toHaveBeenCalled();
  });

  it("forwards the separated cognitive request without reasoning again", async () => {
    const request = jsonRequest(JSON.stringify(cognitiveRequest));
    const response = await POST(request);

    expect(response.status).toBe(200);
    expect(response.headers.get("cache-control")).toBe(
      "no-store",
    );
    expect(mocks.brainAnalyze).not.toHaveBeenCalled();
    expect(mocks.getAuthenticatedUser).toHaveBeenCalledWith(request);
    expect(mocks.reserveUsage).toHaveBeenCalledWith(request, "chat");
    expect(mocks.providerGenerate).toHaveBeenCalledWith(
      cognitiveRequest,
    );
  });

  it("rejects incomplete cognitive payloads instead of downgrading to legacy", async () => {
    const response = await POST(
      jsonRequest(
        JSON.stringify({
          originalUserMessage: "Do not downgrade this.",
          prompt: "legacy fallback",
        }),
      ),
    );

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toMatchObject({
      code: "IAURA_COGNITIVE_REQUEST_INVALID",
    });
    expect(mocks.brainAnalyze).not.toHaveBeenCalled();
    expect(mocks.createProvider).not.toHaveBeenCalled();
  });

  it("adapts legacy requests through Brain before using the provider", async () => {
    mocks.brainAnalyze.mockReturnValue(cognitiveRequest);

    const response = await POST(
      jsonRequest(
        JSON.stringify({
          prompt: "  Legacy request  ",
          instructions: "  Existing context  ",
        }),
      ),
    );

    expect(response.status).toBe(200);
    expect(mocks.brainAnalyze).toHaveBeenCalledWith({
      message: "Legacy request",
      userContext: "Existing context",
    });
    expect(mocks.providerGenerate).toHaveBeenCalledWith(
      cognitiveRequest,
    );
  });

  it("stops a legacy request when Brain validation fails", async () => {
    mocks.brainAnalyze.mockImplementation(() => {
      throw new BrainValidationError([
        {
          code: "IAURA_BRAIN_MESSAGE_REQUIRED",
          field: "message",
          message: "A message is required.",
        },
      ]);
    });

    const response = await POST(
      jsonRequest(JSON.stringify({ prompt: "invalid" })),
    );

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toMatchObject({
      code: "IAURA_COGNITIVE_REQUEST_INVALID",
    });
    expect(mocks.createProvider).not.toHaveBeenCalled();
  });

  it("returns 400 for malformed JSON without calling Brain or OpenAI", async () => {
    const response = await POST(
      jsonRequest("{invalid"),
    );

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toMatchObject({
      code: "IAURA_INVALID_REQUEST",
    });
    expect(mocks.brainAnalyze).not.toHaveBeenCalled();
    expect(mocks.createProvider).not.toHaveBeenCalled();
  });

  it("maps provider failures to a no-store 502 response", async () => {
    vi.spyOn(console, "error").mockImplementation(
      () => undefined,
    );
    mocks.providerGenerate.mockRejectedValue(
      new Error("provider unavailable"),
    );

    const response = await POST(
      jsonRequest(JSON.stringify(cognitiveRequest)),
    );

    expect(response.status).toBe(502);
    expect(response.headers.get("cache-control")).toBe(
      "no-store",
    );
    await expect(response.json()).resolves.toMatchObject({
      code: "IAURA_PROVIDER_ERROR",
    });
  });
});
