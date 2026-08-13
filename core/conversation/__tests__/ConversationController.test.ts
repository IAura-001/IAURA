import {
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from "vitest";

import type {
  ContextPackage,
  ContextRetrievalRequest,
  RetrievedContextItem,
} from "@/core/context";

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
import type { ProjectRepository } from "@/core/project/ProjectRepository";
import type { IAuraProject } from "@/types/project";
import { parseAuraAssistantPlan } from "@/core/actions";

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

function createContextPackage(
  query: string,
  items: RetrievedContextItem[] = [],
): ContextPackage {
  return {
    query,
    items,
    totalCandidates: items.length,
    truncated: false,
    generatedAt:
      new Date("2026-08-02T12:00:00.000Z"),
  };
}

function createContextRetriever(
  items: RetrievedContextItem[] = [],
) {
  return {
    retrieve: vi.fn(
      async (
        request: ContextRetrievalRequest,
      ): Promise<ContextPackage> =>
        createContextPackage(
          request.message.trim(),
          items,
        ),
    ),
  };
}

function createAssistantPlan(
  content: string,
  updates = memoryUpdates,
) {
  return {
    content,
    actions: [],
    memoryUpdates: updates,
    experience: {
      kind: "general" as const,
      title: "",
      summary: "",
      phases: [],
      choices: [],
      recommendedSurface: "none" as const,
    },
  };
}

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

    const contextRetriever =
      createContextRetriever();

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
      new ConversationController({
        contextRetriever,
      });

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
      contextRetriever.retrieve,
    ).toHaveBeenCalledWith({
      userId: "local-user",
      conversationId:
        expect.any(String),
      message: "invalid",
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

  it("adds retrieved context before sending the request to Brain", async () => {
    const contextRetriever =
      createContextRetriever([
        {
          id: "memory-1",
          source: "memory",
          content:
            "The user prefers complete files.",
          relevanceScore: 0.95,
          createdAt:
            new Date(
              "2026-08-02T11:00:00.000Z",
            ),
        },
      ]);

    mocks.analyze.mockReturnValue(
      cognitiveRequest,
    );

    mocks.generateCognitiveResponse.mockResolvedValue(
      createAssistantPlan(
        "Use the approved direction.",
      ),
    );

    const controller =
      new ConversationController({
        contextRetriever,
      });

    await controller.send(
      "Plan the next step.",
      "Project context",
    );

    expect(
      mocks.analyze,
    ).toHaveBeenCalledWith(
      expect.objectContaining({
        message: "Plan the next step.",
        userContext:
          "Project context\n\n[Memoria relevante] The user prefers complete files.",
        conversationIdentity:
          expect.objectContaining({
            conversationId:
              expect.any(String),
          }),
      }),
    );
  });

  it("sends Brain's separated contract to the provider and executes its memory proposals", async () => {
    const contextRetriever =
      createContextRetriever();

    mocks.analyze.mockReturnValue(
      cognitiveRequest,
    );

    mocks.generateCognitiveResponse.mockResolvedValue(
      createAssistantPlan(
        "Use the approved direction.",
      ),
    );

    const controller =
      new ConversationController({
        contextRetriever,
      });

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
      undefined,
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
    const contextRetriever =
      createContextRetriever();

    mocks.analyze.mockReturnValue(
      cognitiveRequest,
    );

    mocks.generateCognitiveResponse.mockResolvedValue(
      createAssistantPlan(
        "No durable memory is needed.",
        [],
      ),
    );

    const controller =
      new ConversationController({
        contextRetriever,
      });

    await controller.send(
      "Explain this temporary error.",
      "Project context",
    );

    expect(
      mocks.executeMemoryUpdates,
    ).toHaveBeenCalledWith([], undefined);

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

  it("uses the same trusted conversation project id for retrieval and memory writes", async () => {
    const activeProject: IAuraProject = {
      id: "iaura-project",
      name: "IAURA",
      description: "Private beta",
      goal: "Validate the beta flow",
      createdAt: "2026-08-01T00:00:00.000Z",
      updatedAt: "2026-08-12T00:00:00.000Z",
      status: "building",
      studios: {
        branding: false,
        website: false,
        app: true,
        marketing: false,
        documents: false,
      },
    };
    const projects = {
      getActiveProject: vi.fn(() => activeProject),
    } as unknown as ProjectRepository;
    const contextRetriever = createContextRetriever();
    mocks.analyze.mockReturnValue(cognitiveRequest);
    mocks.generateCognitiveResponse.mockResolvedValue(
      createAssistantPlan("Decision confirmed."),
    );
    const controller = new ConversationController({
      projects,
      contextRetriever,
    });

    await controller.send("Confirm founders.", "Project context");

    expect(contextRetriever.retrieve).toHaveBeenCalledWith(
      expect.objectContaining({ projectId: "iaura-project" }),
    );
    expect(mocks.executeMemoryUpdates).toHaveBeenCalledWith(
      memoryUpdates,
      "iaura-project",
    );
  });

  it("persists a clicked project decision before continuing its normal prompt turn", async () => {
    const activeProject: IAuraProject = {
      id: "iaura-project",
      name: "IAURA",
      description: "Private beta",
      goal: "Validate the beta flow",
      createdAt: "2026-08-01T00:00:00.000Z",
      updatedAt: "2026-08-12T00:00:00.000Z",
      status: "building",
      studios: { branding: false, website: false, app: true, marketing: false, documents: false },
    };
    const projects = {
      getActiveProject: vi.fn(() => activeProject),
    } as unknown as ProjectRepository;
    const contextRetriever = createContextRetriever();
    mocks.analyze.mockReturnValue(cognitiveRequest);
    mocks.generateCognitiveResponse.mockResolvedValue(
      createAssistantPlan("Decision saved.", []),
    );
    const controller = new ConversationController({ projects, contextRetriever });

    const providerPlan = parseAuraAssistantPlan({
      content: "Choose IAURA's primary beta audience.",
      actions: [],
      memoryUpdates: [],
      experience: {
        kind: "decision",
        title: "Primary beta audience",
        summary: "Choose one durable direction.",
        phases: [],
        choices: [
          {
            label: "Founders building digital products",
            description: "Confirm this as IAURA's primary beta audience.",
            prompt: "Continue with founders building digital products as the confirmed audience.",
            confirmation: {
              kind: "project-decision",
              content: "The primary beta audience is founders building digital products.",
            },
          },
        ],
        recommendedSurface: "presence",
      },
    });

    await controller.sendChoice(
      providerPlan.experience.choices[0],
      "Project context",
    );

    expect(mocks.executeMemoryUpdates).toHaveBeenNthCalledWith(
      1,
      [
        {
          operation: "remember",
          type: "project",
          content: "The primary beta audience is founders building digital products.",
          tags: [],
          reason: "The user explicitly selected this project decision.",
          confidence: 1,
        },
      ],
      "iaura-project",
    );
    expect(contextRetriever.retrieve).toHaveBeenCalledWith(
      expect.objectContaining({ projectId: "iaura-project" }),
    );
    expect(mocks.analyze).toHaveBeenCalledWith(
      expect.objectContaining({
        message: "Continue with founders building digital products as the confirmed audience.",
        conversationIdentity: expect.objectContaining({
          projectId: "iaura-project",
        }),
      }),
    );
  });

  it("continues an unscoped choice without persisting a project decision", async () => {
    mocks.analyze.mockReturnValue(cognitiveRequest);
    mocks.generateCognitiveResponse.mockResolvedValue(
      createAssistantPlan("More detail.", []),
    );
    const controller = new ConversationController({
      contextRetriever: createContextRetriever(),
    });

    await controller.sendChoice(
      {
        label: "Tell me more",
        description: "Continue exploring.",
        prompt: "Tell me more about the options.",
        confirmation: {
          kind: "project-decision",
          content: "This must not become a global project decision.",
        },
      },
      "General context",
    );

    expect(mocks.executeMemoryUpdates).toHaveBeenCalledTimes(1);
    expect(mocks.executeMemoryUpdates).toHaveBeenCalledWith([], undefined);
    expect(conversationMemory.getHistory()[0]).toEqual({
      role: "user",
      content: "Tell me more about the options.",
    });
  });

  it("keeps the clicked decision persisted when the provider fails", async () => {
    const activeProject = {
      id: "nova-project",
      name: "Nova",
    } as IAuraProject;
    const projects = {
      getActiveProject: vi.fn(() => activeProject),
    } as unknown as ProjectRepository;
    mocks.analyze.mockReturnValue(cognitiveRequest);
    mocks.generateCognitiveResponse.mockRejectedValue(new Error("provider failed"));
    const controller = new ConversationController({
      projects,
      contextRetriever: createContextRetriever(),
    });

    await expect(
      controller.sendChoice(
        {
          label: "Founders",
          description: "Confirm founders.",
          prompt: "Continue with founders.",
          confirmation: {
            kind: "project-decision",
            content: "Nova's audience is founders.",
          },
        },
        "Project context",
      ),
    ).rejects.toMatchObject({ code: "IAURA_CONVERSATION_PROVIDER_FAILED" });

    expect(mocks.executeMemoryUpdates).toHaveBeenCalledTimes(1);
    expect(mocks.executeMemoryUpdates).toHaveBeenCalledWith(
      [expect.objectContaining({ content: "Nova's audience is founders." })],
      "nova-project",
    );
  });

  it("stops before Brain when every context source fails", async () => {
    const contextRetriever = {
      retrieve: vi.fn().mockRejectedValue(
        new Error(
          "IAURA_CONTEXT_RETRIEVAL_SOURCES_FAILED",
        ),
      ),
    };

    const controller =
      new ConversationController({
        contextRetriever,
      });

    await expect(
      controller.send(
        "Preserve this message.",
        "Project context",
      ),
    ).rejects.toMatchObject({
      name: "ConversationTurnError",
      code: "IAURA_CONTEXT_RETRIEVAL_FAILED",
      stage: "context",
      recoverable: true,
      conversationId:
        expect.any(String),
      userMessageId:
        expect.any(String),
    });

    expect(
      mocks.analyze,
    ).not.toHaveBeenCalled();

    expect(
      mocks.generateCognitiveResponse,
    ).not.toHaveBeenCalled();

    expect(
      mocks.executeMemoryUpdates,
    ).not.toHaveBeenCalled();

    expect(
      conversationMemory.getHistory(),
    ).toEqual([
      {
        role: "user",
        content:
          "Preserve this message.",
      },
    ]);
  });
});
