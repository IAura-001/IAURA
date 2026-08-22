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
import {
  assistantMessageMetadata,
  conversationRepository,
  LocalConversationRepository,
} from "../ConversationRepository";
import {
  ConversationController,
} from "../ConversationController";
import { selectBetaContinuity } from "../BetaContinuity";
import type { ProjectRepository } from "@/core/project/ProjectRepository";
import type { IAuraProject } from "@/types/project";
import { parseAuraAssistantPlan } from "@/core/actions";
import { DEFAULT_MEMORY } from "@/constants/memory";
import { buildUserContext } from "@/utils/context";
import type { IntelligenceActionReceipt } from "@/core/intelligence";
import { AuthenticatedConversationPersistenceError, AuthenticatedConversationRepository } from "../AuthenticatedConversationRepository";
import { loadVisibleConversation } from "@/components/pages/conversationHydration";

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

  it("returns the exact assistant message id created by the persisted write", async () => {
    mocks.analyze.mockReturnValue(cognitiveRequest);
    mocks.generateCognitiveResponse.mockResolvedValue(
      createAssistantPlan("Persisted response.", []),
    );
    const controller = new ConversationController({
      contextRetriever: createContextRetriever(),
    });

    const result = await controller.send("Persist this.", "Context");
    const persisted = conversationRepository
      .getActiveConversation(null)
      ?.messages.find((message) => message.role === "assistant");

    expect(result.plan.content).toBe("Persisted response.");
    expect(result.assistantMessageId).toBe(persisted?.messageId);
    expect(result.assistantMessageId).toMatch(/^message-/);
  });

  it("waits for both user and assistant remote flushes before completing the turn", async () => {
    mocks.analyze.mockReturnValue(cognitiveRequest);
    mocks.generateCognitiveResponse.mockResolvedValue(
      createAssistantPlan("Persisted response.", []),
    );
    const repository = new LocalConversationRepository({
      synchronize: false,
      persistLocally: false,
    });
    const flush = vi.fn().mockResolvedValue(undefined);
    const controller = new ConversationController({
      conversations: Object.assign(repository, { flush }),
      contextRetriever: createContextRetriever(),
    });

    await controller.send("Persist this.", "Context");

    expect(flush).toHaveBeenCalledTimes(2);
    expect(repository.getActiveConversation(null)?.messages.map(({ role }) => role))
      .toEqual(["user", "assistant"]);
  });

  it("uses a fresh turn's returned assistant id to confirm beta context without reload", async () => {
    const activeProject = { id: "fresh-beta", name: "Fresh Beta" } as IAuraProject;
    const projects = {
      getActiveProject: vi.fn(() => activeProject),
    } as unknown as ProjectRepository;
    const betaPlan = parseAuraAssistantPlan({
      content: "Confirm this context.",
      actions: [],
      memoryUpdates: [],
      experience: {
        kind: "decision",
        title: "Beta context",
        summary: "Confirm the context.",
        phases: [],
        choices: [{
          label: "Confirmar contexto",
          description: "Continue with this context.",
          prompt: "Continue to define the outcome.",
          confirmation: {
            kind: "beta-context",
            goal: "Validate Beta 01",
            blocker: "The next step is unclear",
            summary: "Clarify the first verifiable step",
          },
        }],
        recommendedSurface: "presence",
      },
    });
    mocks.analyze.mockReturnValue(cognitiveRequest);
    mocks.generateCognitiveResponse
      .mockResolvedValueOnce(betaPlan)
      .mockResolvedValueOnce(createAssistantPlan("Define the outcome.", []));
    const controller = new ConversationController({
      projects,
      contextRetriever: createContextRetriever(),
      now: () => "2026-08-13T15:00:00.000Z",
    });

    const freshTurn = await controller.send("Start Beta 01.", "Context");
    await controller.sendChoice(
      freshTurn.plan.experience.choices[0],
      freshTurn.assistantMessageId,
      "Context",
    );

    expect(conversationRepository.getActiveConversation("fresh-beta")?.betaWorkflow)
      .toEqual({
        version: 1,
        status: "defining-outcome",
        confirmedContext: {
          goal: "Validate Beta 01",
          blocker: "The next step is unclear",
          summary: "Clarify the first verifiable step",
          sourceMessageId: freshTurn.assistantMessageId,
          confirmedAt: "2026-08-13T15:00:00.000Z",
        },
      });
  });

  it("rejects missing sources, mismatched choices and metadata write failures", async () => {
    const activeProject = { id: "diagnostic-beta", name: "Diagnostic" } as IAuraProject;
    const projects = { getActiveProject: vi.fn(() => activeProject) } as unknown as ProjectRepository;
    const plan = parseAuraAssistantPlan({
      content: "Confirm.", actions: [], memoryUpdates: [], experience: {
        kind: "decision", title: "Context", summary: "Confirm.", phases: [],
        choices: [{ label: "Confirm", description: "Continue.", prompt: "Continue.", confirmation: {
          kind: "beta-context", goal: "Validate", blocker: "Unknown", summary: "Clarify",
        } }], recommendedSurface: "presence",
      },
    });
    const conversation = conversationRepository.createConversation({
      projectId: "diagnostic-beta",
    }).conversation!;
    conversationRepository.appendMessage(conversation.conversationId, {
      messageId: "diagnostic-source", role: "assistant", content: plan.content,
      structuredResponse: assistantMessageMetadata(plan),
    });
    const controller = new ConversationController({
      projects,
      contextRetriever: createContextRetriever(),
    });

    await expect(controller.sendChoice(plan.experience.choices[0], "missing", "Context"))
      .rejects.toMatchObject({ code: "IAURA_BETA_CONFIRMATION_INVALID" });

    await expect(controller.sendChoice(
      { ...plan.experience.choices[0], label: "Different" },
      "diagnostic-source",
      "Context",
    )).rejects.toMatchObject({ code: "IAURA_BETA_CONFIRMATION_INVALID" });

    vi.spyOn(conversationRepository, "updateConversationMetadata").mockReturnValueOnce({
      ok: false,
      outcome: "failed",
      revision: conversationRepository.getRevision(),
      code: "IAURA_STATE_VALIDATION_FAILED",
      persisted: false,
    });
    await expect(controller.sendChoice(
      plan.experience.choices[0],
      "diagnostic-source",
      "Context",
    )).rejects.toMatchObject({ code: "IAURA_CONVERSATION_PERSISTENCE_FAILED" });
  });

  it("does not infer beta confirmation from a fresh choice label", async () => {
    const activeProject = { id: "label-only", name: "Label Only" } as IAuraProject;
    const projects = {
      getActiveProject: vi.fn(() => activeProject),
    } as unknown as ProjectRepository;
    const plan = parseAuraAssistantPlan({
      content: "Review this.", actions: [], memoryUpdates: [], experience: {
        kind: "decision", title: "Context", summary: "Review.", phases: [],
        choices: [{
          label: "Confirmar contexto", description: "Continue.",
          prompt: "Continue normally.", confirmation: null,
        }], recommendedSurface: "presence",
      },
    });
    mocks.analyze.mockReturnValue(cognitiveRequest);
    mocks.generateCognitiveResponse
      .mockResolvedValueOnce(plan)
      .mockResolvedValueOnce(createAssistantPlan("Continued.", []));
    const controller = new ConversationController({
      projects,
      contextRetriever: createContextRetriever(),
    });

    const freshTurn = await controller.send("Review context.", "Context");
    await controller.sendChoice(
      freshTurn.plan.experience.choices[0],
      freshTurn.assistantMessageId,
      "Context",
    );

    expect(conversationRepository.getActiveConversation("label-only")?.betaWorkflow)
      .toBeUndefined();
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
    const source = conversationRepository.createConversation({
      projectId: "iaura-project",
    }).conversation!;
    const sourceMessage = conversationRepository.appendMessage(
      source.conversationId,
      {
        messageId: "decision-source",
        role: "assistant",
        content: providerPlan.content,
        structuredResponse: assistantMessageMetadata(providerPlan),
      },
    ).message!;

    await controller.sendChoice(
      providerPlan.experience.choices[0],
      sourceMessage.messageId,
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

    const choice = {
        label: "Tell me more",
        description: "Continue exploring.",
        prompt: "Tell me more about the options.",
        confirmation: {
          kind: "project-decision",
          content: "This must not become a global project decision.",
        },
      } as const;
    const plan = parseAuraAssistantPlan({
      ...createAssistantPlan("Choose.", []),
      experience: {
        kind: "general",
        title: "Choose",
        summary: "Choose.",
        phases: [],
        choices: [choice],
        recommendedSurface: "none",
      },
    });
    const source = conversationRepository.createConversation().conversation!;
    conversationRepository.appendMessage(source.conversationId, {
      messageId: "general-source",
      role: "assistant",
      content: plan.content,
      structuredResponse: assistantMessageMetadata(plan),
    });

    await controller.sendChoice(
      choice,
      "general-source",
      "General context",
    );

    expect(mocks.executeMemoryUpdates).toHaveBeenCalledTimes(1);
    expect(mocks.executeMemoryUpdates).toHaveBeenCalledWith([], undefined);
    expect(conversationMemory.getHistory()).toContainEqual({
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

    const choice = {
          label: "Founders",
          description: "Confirm founders.",
          prompt: "Continue with founders.",
          confirmation: {
            kind: "project-decision",
            content: "Nova's audience is founders.",
          },
        } as const;
    const plan = parseAuraAssistantPlan({
      ...createAssistantPlan("Choose founders.", []),
      experience: {
        kind: "decision",
        title: "Audience",
        summary: "Choose founders.",
        phases: [],
        choices: [choice],
        recommendedSurface: "presence",
      },
    });
    const source = conversationRepository.createConversation({
      projectId: "nova-project",
    }).conversation!;
    conversationRepository.appendMessage(source.conversationId, {
      messageId: "nova-source",
      role: "assistant",
      content: plan.content,
      structuredResponse: assistantMessageMetadata(plan),
    });

    await expect(
      controller.sendChoice(
        choice,
        "nova-source",
        "Project context",
      ),
    ).rejects.toMatchObject({ code: "IAURA_CONVERSATION_PROVIDER_FAILED" });

    expect(mocks.executeMemoryUpdates).toHaveBeenCalledTimes(1);
    expect(mocks.executeMemoryUpdates).toHaveBeenCalledWith(
      [expect.objectContaining({ content: "Nova's audience is founders." })],
      "nova-project",
    );
  });

  it("confirms beta context before follow-up generation and exposes it to Aura", async () => {
    const conversations = conversationRepository;
    const activeProject = { id: "iaura-project", name: "IAURA" } as IAuraProject;
    const projects = { getActiveProject: vi.fn(() => activeProject) } as unknown as ProjectRepository;
    const plan = parseAuraAssistantPlan({
      content: "Confirm context.", actions: [], memoryUpdates: [],
      experience: {
        kind: "decision", title: "Context", summary: "Confirm it.", phases: [],
        choices: [
          { label: "Confirm", description: "Continue.", prompt: "Define the outcome.", confirmation: {
            kind: "beta-context", goal: "Launch Beta 01", blocker: "No prioritized next step", summary: "Clarify the next launch step",
          } },
          { label: "Correct", description: "Revise it.", prompt: "Correct the context.", confirmation: null },
        ], recommendedSurface: "presence",
      },
    });
    const conversation = conversations.createConversation({
      conversationId: "beta-conversation", projectId: "iaura-project",
    }).conversation!;
    conversations.appendMessage(conversation.conversationId, {
      messageId: "context-source", role: "assistant", content: plan.content,
      structuredResponse: assistantMessageMetadata(plan),
    });
    expect(conversations.getConversation("beta-conversation")?.betaWorkflow)
      .toBeUndefined();
    mocks.analyze.mockReturnValue(cognitiveRequest);
    mocks.generateCognitiveResponse.mockRejectedValue(new Error("provider failed"));
    const controller = new ConversationController({
      conversations, projects, contextRetriever: createContextRetriever(),
      now: () => "2026-08-13T13:00:00.000Z",
    });

    await expect(
      controller.sendChoice(plan.experience.choices[0], "context-source", "Project context"),
    ).rejects.toMatchObject({ code: "IAURA_CONVERSATION_PROVIDER_FAILED" });

    expect(conversations.getConversation("beta-conversation")?.betaWorkflow).toEqual({
      version: 1,
      status: "defining-outcome",
      confirmedContext: {
        goal: "Launch Beta 01",
        blocker: "No prioritized next step",
        summary: "Clarify the next launch step",
        sourceMessageId: "context-source",
        confirmedAt: "2026-08-13T13:00:00.000Z",
      },
    });
    expect(mocks.analyze).toHaveBeenCalledWith(expect.objectContaining({
      userContext: expect.stringContaining("BETA 01 CONVERSATION WORKFLOW — PROJECT-SCOPED"),
    }));
    expect(mocks.analyze).toHaveBeenCalledWith(expect.objectContaining({
      userContext: expect.stringContaining("Goal: Launch Beta 01"),
    }));
  });

  it("includes the resolved confirmed workflow on a normal typed turn", async () => {
    const projects = {
      getActiveProject: vi.fn(() => ({ id: "iaura", name: "IAURA" } as IAuraProject)),
    } as unknown as ProjectRepository;
    const conversation = conversationRepository.createConversation({
      conversationId: "iaura-typed",
      projectId: "iaura",
    }).conversation!;
    conversationRepository.updateConversationMetadata(conversation.conversationId, {
      betaWorkflow: {
        version: 1,
        status: "recommended",
        confirmedContext: {
          goal: "Launch Beta 01",
          blocker: "No prioritized next step",
          summary: "Clarify the next launch step",
          sourceMessageId: "context-source",
          confirmedAt: "2026-08-13T13:00:00.000Z",
        },
        confirmedOutcome: {
          outcome: "Validate the IAURA Beta 01 direction",
          doneWhen: "Founders complete the validation flow",
          sourceMessageId: "outcome-source",
          confirmedAt: "2026-08-13T14:00:00.000Z",
        },
      },
    });
    conversationRepository.setActiveConversation(conversation.conversationId);
    mocks.analyze.mockReturnValue(cognitiveRequest);
    mocks.generateCognitiveResponse.mockResolvedValue(createAssistantPlan("Confirmed.", []));

    await new ConversationController({
      conversations: conversationRepository,
      projects,
      contextRetriever: createContextRetriever(),
    }).send("Recall the confirmed context.", "Project context");

    expect(mocks.analyze).toHaveBeenCalledWith(expect.objectContaining({
      conversationIdentity: {
        conversationId: "iaura-typed",
        projectId: "iaura",
      },
      userContext: expect.stringContaining(
        "Goal: Launch Beta 01",
      ),
    }));
    expect(mocks.analyze).toHaveBeenCalledWith(expect.objectContaining({
      userContext: expect.stringContaining(
        "Outcome: Validate the IAURA Beta 01 direction",
      ),
    }));
    expect(cognitiveRequest.compiledPrompt).toBe("Canonical IAURA prompt.");
  });

  it("persists the provider recommendation with the authoritative assistant message", async () => {
    const projects = {
      getActiveProject: vi.fn(() => ({ id: "iaura", name: "IAURA" } as IAuraProject)),
    } as unknown as ProjectRepository;
    mocks.analyze.mockReturnValue(cognitiveRequest);
    mocks.generateCognitiveResponse.mockResolvedValue({
      ...createAssistantPlan("One recommendation.", []),
      betaNextStep: {
        action: "Build the first recommendation card.",
        whyNow: "Context and outcome are confirmed.",
        result: "The founder sees one action.",
        doneWhen: "The card survives reload.",
      },
    });

    const turn = await new ConversationController({
      conversations: conversationRepository,
      projects,
      contextRetriever: createContextRetriever(),
    }).send("Recommend one next step.", "Project context");

    const persisted = conversationRepository.getActiveConversation("iaura")
      ?.messages.find(({ messageId }) => messageId === turn.assistantMessageId);
    expect(persisted?.structuredResponse?.betaNextStep).toEqual(turn.plan.betaNextStep);
  });

  it("keeps typed-turn workflow and context isolated to the active project", async () => {
    let activeProject = { id: "iaura", name: "IAURA" } as IAuraProject;
    const projects = {
      getActiveProject: vi.fn(() => activeProject),
    } as unknown as ProjectRepository;
    const iaura = conversationRepository.createConversation({
      conversationId: "iaura-isolated",
      projectId: "iaura",
    }).conversation!;
    conversationRepository.updateConversationMetadata(iaura.conversationId, {
      betaWorkflow: {
        version: 1,
        status: "recommended",
        confirmedContext: {
          goal: "Launch Beta 01",
          blocker: "No prioritized next step",
          summary: "Clarify the next launch step",
          sourceMessageId: "context-source",
          confirmedAt: "2026-08-13T13:00:00.000Z",
        },
        confirmedOutcome: {
          outcome: "Validate the IAURA Beta 01 direction",
          doneWhen: "Founders complete the validation flow",
          sourceMessageId: "outcome-source",
          confirmedAt: "2026-08-13T14:00:00.000Z",
        },
      },
    });
    conversationRepository.setActiveConversation(iaura.conversationId);
    const nova = conversationRepository.createConversation({
      conversationId: "nova-isolated",
      projectId: "nova",
    }).conversation!;
    mocks.analyze.mockReturnValue(cognitiveRequest);
    mocks.generateCognitiveResponse.mockResolvedValue(createAssistantPlan("Ready.", []));
    const contextRetriever = {
      retrieve: vi.fn(async (request: ContextRetrievalRequest) =>
        createContextPackage(request.message, [{
          id: `${request.projectId}-memory`,
          source: "memory" as const,
          content: request.projectId === "iaura"
            ? "IAURA_PROJECT_MEMORY_MARKER"
            : "NOVA_PROJECT_MEMORY_MARKER",
          relevanceScore: 1,
          createdAt: new Date("2026-08-13T13:00:00.000Z"),
          metadata: {},
        }]),
      ),
    };
    const controller = new ConversationController({
      conversations: conversationRepository,
      projects,
      contextRetriever,
    });
    const globalContext = buildUserContext({
      ...DEFAULT_MEMORY,
      preferredLocale: "pt-BR",
      goals: ["IAURA Beta 01 confirmed direction for founders"],
      habits: ["Advance IAURA Beta 01 every day"],
      projects: ["IAURA", "Nova"],
      completedMissionIds: ["iaura-beta-01-context", "iaura-beta-01-outcome"],
    });

    await controller.send("IAURA turn.", globalContext);
    activeProject = { id: "nova", name: "Nova" } as IAuraProject;
    conversationRepository.setActiveConversation(nova.conversationId);
    await controller.send(
      "¿Qué contexto y resultado tenemos confirmados para esta sesión de Beta 01?",
      globalContext,
    );
    activeProject = { id: "iaura", name: "IAURA" } as IAuraProject;
    conversationRepository.setActiveConversation(iaura.conversationId);
    await controller.send("IAURA return turn.", globalContext);

    const brainInputs = mocks.analyze.mock.calls.map(([input]) => input);
    expect(brainInputs[0].userContext).toContain("IAURA_PROJECT_MEMORY_MARKER");
    expect(brainInputs[1].userContext).toContain("NOVA_PROJECT_MEMORY_MARKER");
    expect(brainInputs[1].userContext).toContain(
      "Preferred Language: Brazilian Portuguese (pt-BR)",
    );
    expect(brainInputs[1].userContext).not.toContain("IAURA_PROJECT_MEMORY_MARKER");
    expect(brainInputs[1].userContext).not.toContain(
      "IAURA Beta 01 confirmed direction for founders",
    );
    expect(brainInputs[1].userContext).not.toContain(
      "iaura-beta-01-context",
    );
    expect(brainInputs[1].userContext).not.toContain(
      "BETA 01 CONVERSATION WORKFLOW",
    );
    expect(brainInputs[2].userContext).toContain("IAURA_PROJECT_MEMORY_MARKER");
    expect(brainInputs[2].userContext).toContain(
      "BETA 01 CONVERSATION WORKFLOW",
    );
  });

  it("forwards pre-existing history only from the resolved conversation", async () => {
    const projects = {
      getActiveProject: vi.fn(() => ({ id: "nova-history", name: "Nova" } as IAuraProject)),
    } as unknown as ProjectRepository;
    const conversation = conversationRepository.createConversation({
      conversationId: "nova-contaminated-history",
      projectId: "nova-history",
    }).conversation!;
    conversationRepository.appendMessage(conversation.conversationId, {
      messageId: "old-user",
      role: "user",
      content: "Continue the Nova review.",
    });
    conversationRepository.appendMessage(conversation.conversationId, {
      messageId: "old-assistant",
      role: "assistant",
      content: "The IAURA Beta 01 context was previously described here.",
    });
    conversationRepository.setActiveConversation(conversation.conversationId);
    mocks.analyze.mockReturnValue(cognitiveRequest);
    mocks.generateCognitiveResponse.mockResolvedValue(createAssistantPlan("Nova response.", []));

    await new ConversationController({
      conversations: conversationRepository,
      projects,
    }).send(
      "¿Qué contexto y resultado tenemos confirmados para esta sesión de Beta 01?",
      buildUserContext({ ...DEFAULT_MEMORY, preferredLocale: "pt-BR" }),
    );

    const brainInput = mocks.analyze.mock.calls.at(-1)?.[0];
    expect(brainInput?.history).toContainEqual({
      role: "assistant",
      content: "The IAURA Beta 01 context was previously described here.",
    });
    expect(brainInput?.userContext).toContain(
      "The IAURA Beta 01 context was previously described here.",
    );
  });

  it("does not confirm a correction choice", async () => {
    const conversations = conversationRepository;
    const projects = { getActiveProject: vi.fn(() => ({ id: "iaura", name: "IAURA" } as IAuraProject)) } as unknown as ProjectRepository;
    const plan = parseAuraAssistantPlan({
      content: "Review.", actions: [], memoryUpdates: [], experience: {
        kind: "decision", title: "Context", summary: "Review.", phases: [],
        choices: [{ label: "Correct", description: "Revise.", prompt: "Correct it.", confirmation: null }],
        recommendedSurface: "presence",
      },
    });
    const conversation = conversations.createConversation({ projectId: "iaura" }).conversation!;
    conversations.appendMessage(conversation.conversationId, {
      messageId: "correction-source", role: "assistant", content: plan.content,
      structuredResponse: assistantMessageMetadata(plan),
    });
    mocks.analyze.mockReturnValue(cognitiveRequest);
    mocks.generateCognitiveResponse.mockResolvedValue(createAssistantPlan("Revised.", []));

    await new ConversationController({ conversations, projects, contextRetriever: createContextRetriever() })
      .sendChoice(plan.experience.choices[0], "correction-source", "Context");

    expect(conversations.getConversation(conversation.conversationId)?.betaWorkflow).toBeUndefined();
  });

  it("confirms beta outcome only after context and rejects invented or cross-project sources", async () => {
    const conversations = conversationRepository;
    let activeProject = { id: "iaura", name: "IAURA" } as IAuraProject;
    const projects = { getActiveProject: vi.fn(() => activeProject) } as unknown as ProjectRepository;
    const plan = parseAuraAssistantPlan({
      content: "Confirm outcome.", actions: [], memoryUpdates: [], experience: {
        kind: "decision", title: "Outcome", summary: "Confirm.", phases: [],
        choices: [{ label: "Confirm", description: "Use it.", prompt: "Continue.", confirmation: {
          kind: "beta-outcome", outcome: "A one-sentence proposition", doneWhen: "It names user, problem and benefit",
        } }], recommendedSurface: "presence",
      },
    });
    const conversation = conversations.createConversation({ conversationId: "iaura-beta", projectId: "iaura" }).conversation!;
    conversations.appendMessage(conversation.conversationId, {
      messageId: "outcome-source", role: "assistant", content: plan.content,
      structuredResponse: assistantMessageMetadata(plan),
    });
    const controller = new ConversationController({ conversations, projects, contextRetriever: createContextRetriever() });

    await expect(controller.sendChoice(plan.experience.choices[0], "outcome-source", "Context"))
      .rejects.toMatchObject({ code: "IAURA_BETA_CONFIRMATION_OUT_OF_SEQUENCE" });

    conversations.updateConversationMetadata(conversation.conversationId, {
      betaWorkflow: { version: 1, status: "defining-outcome", confirmedContext: {
        goal: "Launch", blocker: "Unclear step", summary: "Clarify launch", sourceMessageId: "context-source", confirmedAt: "2026-08-13T10:00:00.000Z",
      } },
    });
    mocks.analyze.mockReturnValue(cognitiveRequest);
    mocks.generateCognitiveResponse.mockResolvedValue(createAssistantPlan("Ready.", []));
    await controller.sendChoice(plan.experience.choices[0], "outcome-source", "Context");
    expect(conversations.getConversation("iaura-beta")?.betaWorkflow).toMatchObject({
      status: "recommended",
      confirmedOutcome: {
        outcome: "A one-sentence proposition",
        doneWhen: "It names user, problem and benefit",
        sourceMessageId: "outcome-source",
      },
    });

    activeProject = { id: "nova", name: "Nova" } as IAuraProject;
    await expect(controller.sendChoice(plan.experience.choices[0], "outcome-source", "Context"))
      .rejects.toMatchObject({ code: "IAURA_BETA_CONFIRMATION_INVALID" });
    await expect(controller.sendChoice(plan.experience.choices[0], "invented", "Context"))
      .rejects.toMatchObject({ code: "IAURA_BETA_CONFIRMATION_INVALID" });
  });

  it("confirms only the exact persisted next-step choice and preserves prior workflow", async () => {
    let activeProject = { id: "iaura", name: "IAURA" } as IAuraProject;
    const projects = { getActiveProject: vi.fn(() => activeProject) } as unknown as ProjectRepository;
    const recommendation = {
      action: "Build the card", whyNow: "The outcome is confirmed",
      result: "One action is visible", doneWhen: "The card survives reload",
    };
    const plan = parseAuraAssistantPlan({
      content: "One next step.", betaNextStep: recommendation,
      experience: {
        kind: "decision", title: "Next", summary: "Confirm", phases: [],
        choices: [{
          label: "Confirmar siguiente paso", description: "Confirm", prompt: "Continue",
          confirmation: { kind: "beta-next-step", ...recommendation },
        }], recommendedSurface: "presence",
      },
    });
    const conversation = conversationRepository.createConversation({
      conversationId: "iaura-next-step", projectId: "iaura",
    }).conversation!;
    conversationRepository.updateConversationMetadata(conversation.conversationId, {
      betaWorkflow: {
        version: 1, status: "recommended",
        confirmedContext: {
          goal: "Launch", blocker: "No step", summary: "Choose one",
          sourceMessageId: "context", confirmedAt: "2026-08-13T12:00:00.000Z",
        },
        confirmedOutcome: {
          outcome: "Working card", doneWhen: "Visible",
          sourceMessageId: "outcome", confirmedAt: "2026-08-13T12:05:00.000Z",
        },
      },
    });
    conversationRepository.appendMessage(conversation.conversationId, {
      messageId: "recommendation-source", role: "assistant", content: plan.content,
      structuredResponse: assistantMessageMetadata(plan),
    });
    mocks.analyze.mockReturnValue(cognitiveRequest);
    mocks.generateCognitiveResponse.mockResolvedValue(createAssistantPlan("Ready to start.", []));
    const controller = new ConversationController({
      conversations: conversationRepository, projects,
      contextRetriever: createContextRetriever(), now: () => "2026-08-13T12:10:00.000Z",
    });

    await expect(controller.sendChoice(
      { ...plan.experience.choices[0], label: "Invented" },
      "recommendation-source", "Context",
    )).rejects.toMatchObject({ code: "IAURA_BETA_CONFIRMATION_INVALID" });
    await expect(controller.sendChoice(
      plan.experience.choices[0], "missing", "Context",
    )).rejects.toMatchObject({ code: "IAURA_BETA_CONFIRMATION_INVALID" });

    const readyTurn = await controller.sendChoice(
      plan.experience.choices[0], "recommendation-source", "Context",
    );
    expect(conversationRepository.getConversation("iaura-next-step")?.betaWorkflow)
      .toMatchObject({
        status: "ready-to-start",
        confirmedContext: { sourceMessageId: "context" },
        confirmedOutcome: { sourceMessageId: "outcome" },
        confirmedNextStep: {
          ...recommendation,
          sourceMessageId: "recommendation-source",
          confirmedAt: "2026-08-13T12:10:00.000Z",
        },
      });
    expect(mocks.analyze).toHaveBeenCalledWith(expect.objectContaining({
      userContext: expect.stringContaining("Confirmed next step:\n- Action: Build the card"),
    }));
    expect(readyTurn.plan.experience.choices.map((choice) => [
      choice.label,
      choice.confirmation,
    ])).toEqual([
      ["Empezar ahora", { kind: "beta-session-decision", decision: "start-now" }],
      ["Continuar después", { kind: "beta-session-decision", decision: "continue-later" }],
    ]);
    expect(conversationRepository.getConversation("iaura-next-step")?.messages
      .find((message) => message.messageId === readyTurn.assistantMessageId)
      ?.structuredResponse?.experience?.choices).toEqual(readyTurn.plan.experience.choices);

    await controller.sendChoice(
      readyTurn.plan.experience.choices[1], readyTurn.assistantMessageId, "Context",
    );
    const deferredConversation = conversationRepository.getConversation("iaura-next-step")!;
    expect(deferredConversation.betaWorkflow).toMatchObject({
      status: "deferred",
      confirmedNextStep: { ...recommendation, sourceMessageId: "recommendation-source" },
      sessionDecision: {
        kind: "continue-later", sourceMessageId: readyTurn.assistantMessageId,
      },
    });
    expect(selectBetaContinuity(deferredConversation)).toMatchObject({
      state: "deferred",
      confirmedStep: "Build the card",
      primaryAction: { kind: "resume-deferred", label: "Retomar paso" },
    });

    activeProject = { id: "nova", name: "Nova" } as IAuraProject;
    await expect(controller.sendChoice(
      plan.experience.choices[0], "recommendation-source", "Context",
    )).rejects.toMatchObject({ code: "IAURA_BETA_CONFIRMATION_INVALID" });
    expect(conversationRepository.getActiveConversation("nova")?.betaWorkflow)
      .toBeUndefined();
  });

  it("rejects a persisted next-step choice that does not match its persisted proposal", async () => {
    const projects = { getActiveProject: vi.fn(() => ({ id: "iaura", name: "IAURA" } as IAuraProject)) } as unknown as ProjectRepository;
    const plan = parseAuraAssistantPlan({
      content: "Review", betaNextStep: {
        action: "Build", whyNow: "Now", result: "Card", doneWhen: "Visible",
      }, experience: {
        kind: "decision", title: "Next", summary: "Review", phases: [],
        choices: [{ label: "Confirm", description: "Confirm", prompt: "Continue", confirmation: {
          kind: "beta-next-step", action: "Different", whyNow: "Now", result: "Card", doneWhen: "Visible",
        } }], recommendedSurface: "presence",
      },
    });
    const conversation = conversationRepository.createConversation({ projectId: "iaura" }).conversation!;
    conversationRepository.updateConversationMetadata(conversation.conversationId, {
      betaWorkflow: { version: 1, status: "recommended",
        confirmedContext: { goal: "G", blocker: "B", summary: "S", sourceMessageId: "c", confirmedAt: "2026-08-13T12:00:00Z" },
        confirmedOutcome: { outcome: "O", doneWhen: "D", sourceMessageId: "o", confirmedAt: "2026-08-13T12:01:00Z" },
      },
    });
    conversationRepository.appendMessage(conversation.conversationId, {
      messageId: "source", role: "assistant", content: plan.content,
      structuredResponse: assistantMessageMetadata(plan),
    });
    await expect(new ConversationController({ conversations: conversationRepository, projects })
      .sendChoice(plan.experience.choices[0], "source", "Context"))
      .rejects.toMatchObject({ code: "IAURA_BETA_CONFIRMATION_INVALID" });
  });

  it.each([
    ["defining-outcome", false],
    ["recommended", true],
  ] as const)(
    "filters start-now while workflow is %s and keeps provisional recommendation unconfirmed",
    async (status, hasOutcome) => {
      const projects = { getActiveProject: vi.fn(() => ({ id: "iaura", name: "IAURA" } as IAuraProject)) } as unknown as ProjectRepository;
      const recommendation = { action: "A", whyNow: "W", result: "R", doneWhen: "D" };
      const generated = parseAuraAssistantPlan({ content: "Continue.", betaNextStep: recommendation,
        experience: { kind: "decision", title: "Continue", summary: "Continue", phases: [], choices: [
          { label: "Confirmar siguiente paso", description: "Confirm", prompt: "Confirm", confirmation: { kind: "beta-next-step", ...recommendation } },
          { label: "Empezar ahora", description: "Start", prompt: "Start", confirmation: { kind: "beta-session-decision", decision: "start-now" } },
        ], recommendedSurface: "presence" },
      });
      const conversation = conversationRepository.createConversation({ projectId: "iaura" }).conversation!;
      conversationRepository.updateConversationMetadata(conversation.conversationId, { betaWorkflow: {
        version: 1, status,
        confirmedContext: { goal: "G", blocker: "B", summary: "S", sourceMessageId: "c", confirmedAt: "2026-08-13T12:00:00Z" },
        ...(hasOutcome ? { confirmedOutcome: { outcome: "O", doneWhen: "D", sourceMessageId: "o", confirmedAt: "2026-08-13T12:01:00Z" } } : {}),
      } });
      mocks.analyze.mockReturnValue(cognitiveRequest);
      mocks.generateCognitiveResponse.mockResolvedValue(generated);
      const controller = new ConversationController({ conversations: conversationRepository, projects, contextRetriever: createContextRetriever() });

      const displayed = await controller.send("Continue", "Context");
      expect(displayed.plan.experience.choices).not.toEqual(expect.arrayContaining([
        expect.objectContaining({ confirmation: { kind: "beta-session-decision", decision: "start-now" } }),
      ]));
      if (hasOutcome) {
        expect(displayed.plan.betaNextStep).toEqual(recommendation);
        expect(displayed.plan.experience.choices[0].confirmation)
          .toMatchObject({ kind: "beta-next-step" });
        expect(conversationRepository.getConversation(conversation.conversationId)?.betaWorkflow)
          .not.toHaveProperty("confirmedNextStep");
      } else {
        expect(displayed.plan).not.toHaveProperty("betaNextStep");
      }
      await expect(controller.sendChoice(
        generated.experience.choices[1], displayed.assistantMessageId, "Context",
      )).rejects.toMatchObject({ code: "IAURA_BETA_CONFIRMATION_INVALID" });
    },
  );

  it.each([
    ["start-now", "started"],
    ["continue-later", "deferred"],
  ] as const)("persists trusted session decision %s without losing confirmed workflow", async (decision, status) => {
    let activeProject = { id: "iaura", name: "IAURA" } as IAuraProject;
    const projects = { getActiveProject: vi.fn(() => activeProject) } as unknown as ProjectRepository;
    const plan = parseAuraAssistantPlan({ content: "Choose.", experience: {
      kind: "decision", title: "Session", summary: "Choose", phases: [],
      choices: [{ label: "Choose", description: "Choose", prompt: "Continue", confirmation: {
        kind: "beta-session-decision", decision,
      } }], recommendedSurface: "presence",
    } });
    const conversation = conversationRepository.createConversation({
      conversationId: `session-${decision}`, projectId: "iaura",
    }).conversation!;
    conversationRepository.updateConversationMetadata(conversation.conversationId, { betaWorkflow: {
      version: 1, status: "ready-to-start",
      confirmedContext: { goal: "G", blocker: "B", summary: "S", sourceMessageId: "c", confirmedAt: "2026-08-13T12:00:00Z" },
      confirmedOutcome: { outcome: "O", doneWhen: "D", sourceMessageId: "o", confirmedAt: "2026-08-13T12:01:00Z" },
      confirmedNextStep: { action: "A", whyNow: "W", result: "R", doneWhen: "D", sourceMessageId: "n", confirmedAt: "2026-08-13T12:02:00Z" },
    } });
    conversationRepository.appendMessage(conversation.conversationId, {
      messageId: "decision-source", role: "assistant", content: plan.content,
      structuredResponse: assistantMessageMetadata(plan),
    });
    mocks.analyze.mockReturnValue(cognitiveRequest);
    mocks.generateCognitiveResponse.mockResolvedValue(createAssistantPlan("Decision recorded.", []));
    const controller = new ConversationController({
      conversations: conversationRepository, projects,
      contextRetriever: createContextRetriever(), now: () => "2026-08-13T12:03:00Z",
    });

    await expect(controller.sendChoice({ ...plan.experience.choices[0], label: "Invented" }, "decision-source", "Context"))
      .rejects.toMatchObject({ code: "IAURA_BETA_CONFIRMATION_INVALID" });
    await expect(controller.sendChoice(plan.experience.choices[0], "missing", "Context"))
      .rejects.toMatchObject({ code: "IAURA_BETA_CONFIRMATION_INVALID" });
    await controller.sendChoice(plan.experience.choices[0], "decision-source", "Context");

    expect(conversationRepository.getConversation(conversation.conversationId)?.betaWorkflow)
      .toMatchObject({
        status,
        confirmedContext: { sourceMessageId: "c" },
        confirmedOutcome: { sourceMessageId: "o" },
        confirmedNextStep: { sourceMessageId: "n", action: "A" },
        sessionDecision: { kind: decision, sourceMessageId: "decision-source", decidedAt: "2026-08-13T12:03:00Z" },
      });
    expect(mocks.analyze).toHaveBeenCalledWith(expect.objectContaining({
      userContext: expect.stringContaining(
        decision === "start-now"
          ? "completion has not been verified"
          : "Execution status: Not started",
      ),
    }));

    activeProject = { id: "nova", name: "Nova" } as IAuraProject;
    await expect(controller.sendChoice(plan.experience.choices[0], "decision-source", "Context"))
      .rejects.toMatchObject({ code: "IAURA_BETA_CONFIRMATION_INVALID" });
  });

  it("rejects a session decision before ready-to-start", async () => {
    const projects = { getActiveProject: vi.fn(() => ({ id: "iaura", name: "IAURA" } as IAuraProject)) } as unknown as ProjectRepository;
    const plan = parseAuraAssistantPlan({ content: "Choose.", experience: {
      kind: "decision", title: "Session", summary: "Choose", phases: [],
      choices: [{ label: "Start", description: "Start", prompt: "Start", confirmation: {
        kind: "beta-session-decision", decision: "start-now",
      } }], recommendedSurface: "presence",
    } });
    const conversation = conversationRepository.createConversation({ projectId: "iaura" }).conversation!;
    conversationRepository.appendMessage(conversation.conversationId, {
      messageId: "source", role: "assistant", content: plan.content,
      structuredResponse: assistantMessageMetadata(plan),
    });
    await expect(new ConversationController({ conversations: conversationRepository, projects })
      .sendChoice(plan.experience.choices[0], "source", "Context"))
      .rejects.toMatchObject({ code: "IAURA_BETA_CONFIRMATION_OUT_OF_SEQUENCE" });
  });

  it.each([
    ["failed", false, "started"],
    ["partial", false, "started"],
    ["passed", false, "started"],
    ["passed", true, "evaluated"],
  ] as const)(
    "verifies %s evidence with done-when %s and derives %s truthfully",
    async (result, doneWhenSatisfied, expectedStatus) => {
      const projects = {
        getActiveProject: vi.fn(() => ({ id: "iaura", name: "IAURA" } as IAuraProject)),
      } as unknown as ProjectRepository;
      const conversation = conversationRepository.createConversation({
        conversationId: `evidence-${result}-${doneWhenSatisfied}`,
        projectId: "iaura",
      }).conversation!;
      conversationRepository.updateConversationMetadata(conversation.conversationId, {
        betaWorkflow: {
          version: 1, status: "started",
          confirmedContext: { goal: "G", blocker: "B", summary: "S", sourceMessageId: "c", confirmedAt: "2026-08-13T12:00:00Z" },
          confirmedOutcome: { outcome: "O", doneWhen: "D", sourceMessageId: "o", confirmedAt: "2026-08-13T12:01:00Z" },
          confirmedNextStep: { action: "A", whyNow: "W", result: "R", doneWhen: "Visible", sourceMessageId: "n", confirmedAt: "2026-08-13T12:02:00Z" },
          sessionDecision: { kind: "start-now", sourceMessageId: "d", decidedAt: "2026-08-13T12:03:00Z" },
        },
      });
      const evaluationPlan = parseAuraAssistantPlan({
        content: "Evaluación provisional.",
        betaExecutionEvaluation: { result, observation: "Founder observation", doneWhenSatisfied },
        experience: {
          kind: "decision", title: "Evidence", summary: "Review", phases: [],
          choices: [{ label: "Confirmar evaluación", description: "Confirm", prompt: "Record it", confirmation: {
            kind: "beta-execution-evaluation", result,
            observation: "Founder observation", doneWhenSatisfied,
          } }], recommendedSurface: "presence",
        },
      });
      mocks.analyze.mockReturnValue(cognitiveRequest);
      mocks.generateCognitiveResponse
        .mockResolvedValueOnce(evaluationPlan)
        .mockResolvedValueOnce({ ...evaluationPlan, content: "Evidence recorded." });
      const controller = new ConversationController({
        conversations: conversationRepository,
        projects,
        contextRetriever: createContextRetriever(),
        now: () => "2026-08-13T12:04:00Z",
        evidenceIdFactory: () => "application-evidence-id",
      });

      const provisional = await controller.send("I tested it.", "Context");
      expect(conversationRepository.getConversation(conversation.conversationId)?.betaWorkflow)
        .not.toHaveProperty("verifiedExecutions");
      const assistant = conversationRepository.getConversation(conversation.conversationId)
        ?.messages.find((message) => message.messageId === provisional.assistantMessageId);
      expect(assistant?.structuredResponse).toMatchObject({
        sourceUserMessageId: expect.any(String),
        betaExecutionEvaluation: { result, observation: "Founder observation", doneWhenSatisfied },
      });

      await expect(controller.sendChoice(
        { ...evaluationPlan.experience.choices[0], label: "Invented" },
        provisional.assistantMessageId,
        "Context",
      )).rejects.toMatchObject({ code: "IAURA_BETA_CONFIRMATION_INVALID" });
      const acknowledgment = await controller.sendChoice(
        evaluationPlan.experience.choices[0],
        provisional.assistantMessageId,
        "Context",
      );

      expect(acknowledgment.plan.content).toBe("Evidence recorded.");
      expect(acknowledgment.plan).not.toHaveProperty("betaExecutionEvaluation");
      expect(conversationRepository.getConversation(conversation.conversationId)?.messages.at(-1)
        ?.structuredResponse).not.toHaveProperty("betaExecutionEvaluation");

      expect(conversationRepository.getConversation(conversation.conversationId)?.betaWorkflow)
        .toMatchObject({
          status: expectedStatus,
          verifiedExecutions: [{
            evidenceId: "application-evidence-id",
            result,
            doneWhenSatisfied,
            sourceMessageId: provisional.assistantMessageId,
            verifiedAt: "2026-08-13T12:04:00Z",
          }],
        });
      expect(conversationRepository.getConversation(conversation.conversationId)?.betaWorkflow?.status)
        .not.toBe("closed");
      expect(mocks.analyze).toHaveBeenLastCalledWith(expect.objectContaining({
        userContext: expect.stringContaining("Verified execution evidence"),
      }));
    },
  );

  it("accepts a new execution report after verified partial evidence without duplicating the first evidence", async () => {
    const projects = {
      getActiveProject: vi.fn(() => ({ id: "iaura", name: "IAURA" } as IAuraProject)),
    } as unknown as ProjectRepository;
    const conversation = conversationRepository.createConversation({
      conversationId: "partial-retry",
      projectId: "iaura",
    }).conversation!;
    conversationRepository.updateConversationMetadata(conversation.conversationId, {
      betaWorkflow: {
        version: 1, status: "started",
        confirmedContext: { goal: "G", blocker: "B", summary: "S", sourceMessageId: "c", confirmedAt: "2026-08-13T12:00:00Z" },
        confirmedOutcome: { outcome: "O", doneWhen: "D", sourceMessageId: "o", confirmedAt: "2026-08-13T12:01:00Z" },
        confirmedNextStep: { action: "A", whyNow: "W", result: "R", doneWhen: "Visible", sourceMessageId: "n", confirmedAt: "2026-08-13T12:02:00Z" },
        sessionDecision: { kind: "start-now", sourceMessageId: "d", decidedAt: "2026-08-13T12:03:00Z" },
      },
    });
    const evaluationPlan = parseAuraAssistantPlan({
      content: "Review this attempt.",
      betaExecutionEvaluation: { result: "partial", observation: "First attempt", doneWhenSatisfied: false },
      experience: {
        kind: "decision", title: "Evidence", summary: "Review", phases: [],
        choices: [{ label: "Confirm", description: "Confirm", prompt: "Record it", confirmation: {
          kind: "beta-execution-evaluation", result: "partial", observation: "First attempt", doneWhenSatisfied: false,
        } }], recommendedSurface: "presence",
      },
    });
    const nextEvaluationPlan = parseAuraAssistantPlan({
      ...evaluationPlan,
      content: "Review the new attempt.",
      betaExecutionEvaluation: { result: "passed", observation: "Second attempt", doneWhenSatisfied: false },
      experience: {
        ...evaluationPlan.experience,
        choices: [{ label: "Confirm", description: "Confirm", prompt: "Record it", confirmation: {
          kind: "beta-execution-evaluation", result: "passed", observation: "Second attempt", doneWhenSatisfied: false,
        } }],
      },
    });
    const recoveryPlan = parseAuraAssistantPlan({
      content: "The incomplete evidence is preserved and the same step remains active.",
      experience: {
        kind: "decision", title: "Recover the same step", summary: "Choose explicitly", phases: [],
        choices: [
          { label: "Reintentar ahora", description: "Retry", prompt: "Retry the same step now", confirmation: {
            kind: "beta-incomplete-execution-recovery", decision: "retry-now",
          } },
          { label: "Continuar después", description: "Later", prompt: "Continue the same step later", confirmation: {
            kind: "beta-incomplete-execution-recovery", decision: "retry-later",
          } },
        ], recommendedSurface: "presence",
      },
    });
    mocks.analyze.mockReturnValue(cognitiveRequest);
    mocks.generateCognitiveResponse
      .mockResolvedValueOnce(evaluationPlan)
      .mockResolvedValueOnce(recoveryPlan)
      .mockResolvedValueOnce(recoveryPlan)
      .mockResolvedValueOnce({ ...recoveryPlan, content: "Retry ready." })
      .mockResolvedValueOnce(nextEvaluationPlan)
      .mockResolvedValueOnce({ ...nextEvaluationPlan, content: "Second attempt recorded." });
    let evidenceSequence = 0;
    const controller = new ConversationController({
      conversations: conversationRepository,
      projects,
      contextRetriever: createContextRetriever(),
      evidenceIdFactory: () => `evidence-${++evidenceSequence}`,
    });

    const provisional = await controller.send("First execution report", "Context");
    await controller.sendChoice(
      evaluationPlan.experience.choices[0],
      provisional.assistantMessageId,
      "Context",
    );
    const replay = await controller.sendChoice(
      evaluationPlan.experience.choices[0],
      provisional.assistantMessageId,
      "Context",
    );
    expect(replay.plan).not.toHaveProperty("betaExecutionEvaluation");
    expect(replay.plan.experience.choices.map((choice) => choice.label))
      .toEqual(["Reintentar ahora", "Continuar después"]);
    expect(conversationRepository.getConversation(conversation.conversationId)
      ?.betaWorkflow?.verifiedExecutions).toHaveLength(1);
    await controller.sendChoice(
      replay.plan.experience.choices[0],
      replay.assistantMessageId,
      "Context",
    );
    expect(conversationRepository.getConversation(conversation.conversationId)?.betaWorkflow)
      .toMatchObject({
        status: "started",
        incompleteExecutionRecoveries: [{
          decision: "retry-now",
          evidenceId: "evidence-1",
          sourceMessageId: replay.assistantMessageId,
        }],
      });
    const nextProvisional = await controller.send("New execution report", "Context");

    expect(nextProvisional.plan.betaExecutionEvaluation).toEqual({
      result: "passed", observation: "Second attempt", doneWhenSatisfied: false,
    });
    expect(conversationRepository.getConversation(conversation.conversationId)
      ?.betaWorkflow?.verifiedExecutions).toHaveLength(1);
    const secondAcknowledgment = await controller.sendChoice(
      nextEvaluationPlan.experience.choices[0],
      nextProvisional.assistantMessageId,
      "Context",
    );
    expect(secondAcknowledgment.plan).not.toHaveProperty("betaExecutionEvaluation");
    expect(conversationRepository.getConversation(conversation.conversationId)
      ?.betaWorkflow?.verifiedExecutions).toHaveLength(2);
  });

  it("defers only through a trusted latest incomplete-evidence recovery choice", async () => {
    const projects = {
      getActiveProject: vi.fn(() => ({ id: "iaura", name: "IAURA" } as IAuraProject)),
    } as unknown as ProjectRepository;
    const conversation = conversationRepository.createConversation({
      conversationId: "retry-later", projectId: "iaura",
    }).conversation!;
    conversationRepository.appendMessage(conversation.conversationId, {
      messageId: "report", role: "user", content: "It failed.",
    });
    conversationRepository.appendMessage(conversation.conversationId, {
      messageId: "evaluation", role: "assistant", content: "Failed evidence.",
      structuredResponse: {
        actionTypes: [], experienceKind: "decision", recommendedSurface: "presence",
        sourceUserMessageId: "report",
        betaExecutionEvaluation: {
          result: "failed", observation: "It failed", doneWhenSatisfied: false,
        },
      },
    });
    conversationRepository.updateConversationMetadata(conversation.conversationId, {
      betaWorkflow: {
        version: 1, status: "started",
        confirmedContext: { goal: "G", blocker: "B", summary: "S", sourceMessageId: "c", confirmedAt: "2026-08-13T12:00:00Z" },
        confirmedOutcome: { outcome: "O", doneWhen: "D", sourceMessageId: "o", confirmedAt: "2026-08-13T12:01:00Z" },
        confirmedNextStep: { action: "A", whyNow: "W", result: "R", doneWhen: "D", sourceMessageId: "n", confirmedAt: "2026-08-13T12:02:00Z" },
        sessionDecision: { kind: "start-now", sourceMessageId: "d", decidedAt: "2026-08-13T12:03:00Z" },
        verifiedExecutions: [{ evidenceId: "failed-evidence", result: "failed", observation: "It failed", doneWhenSatisfied: false, sourceUserMessageId: "report", sourceMessageId: "evaluation", verifiedAt: "2026-08-13T12:04:00Z" }],
      },
    });
    const recoveryPlan = parseAuraAssistantPlan({
      content: "Evidence preserved; choose for the same step.",
      experience: {
        kind: "decision", title: "Recovery", summary: "Same step", phases: [],
        choices: [
          { label: "Reintentar ahora", description: "Retry", prompt: "Retry", confirmation: { kind: "beta-incomplete-execution-recovery", decision: "retry-now" } },
          { label: "Continuar después", description: "Later", prompt: "Later", confirmation: { kind: "beta-incomplete-execution-recovery", decision: "retry-later" } },
          { label: "Replace", description: "Unsafe", prompt: "Replace", confirmation: null },
        ], recommendedSurface: "presence",
      },
    });
    const resumePlan = parseAuraAssistantPlan({
      content: "Resume the preserved step.",
      experience: {
        kind: "decision", title: "Resume", summary: "Resume pending", phases: [],
        choices: [{
          label: "Empezar ahora", description: "Resume", prompt: "Resume now", confirmation: {
            kind: "beta-session-decision", decision: "start-now",
          },
        }], recommendedSurface: "presence",
      },
    });
    const passedPlan = parseAuraAssistantPlan({
      content: "Review the resumed attempt.",
      betaExecutionEvaluation: {
        result: "passed", observation: "Resumed attempt passed", doneWhenSatisfied: true,
      },
      experience: {
        kind: "decision", title: "Evaluation", summary: "Review", phases: [],
        choices: [{ label: "Confirm", description: "Confirm", prompt: "Confirm", confirmation: {
          kind: "beta-execution-evaluation", result: "passed",
          observation: "Resumed attempt passed", doneWhenSatisfied: true,
        } }], recommendedSurface: "presence",
      },
    });
    mocks.analyze.mockReturnValue(cognitiveRequest);
    mocks.generateCognitiveResponse
      .mockResolvedValueOnce(recoveryPlan)
      .mockResolvedValueOnce({ ...recoveryPlan, content: "Deferred." })
      .mockResolvedValueOnce(resumePlan)
      .mockResolvedValueOnce(resumePlan)
      .mockResolvedValueOnce(passedPlan)
      .mockResolvedValueOnce({ ...passedPlan, content: "Passed evidence recorded." });
    let now = "2026-08-13T12:05:00Z";
    const controller = new ConversationController({
      conversations: conversationRepository, projects,
      contextRetriever: createContextRetriever(),
      now: () => now,
    });

    const offered = await controller.send("What should I do?", "Context");
    expect(offered.plan).not.toHaveProperty("betaExecutionEvaluation");
    expect(offered.plan.experience.choices.map((choice) => choice.label))
      .toEqual(["Reintentar ahora", "Continuar después"]);
    await controller.sendChoice(
      offered.plan.experience.choices[1], offered.assistantMessageId, "Context",
    );
    expect(conversationRepository.getConversation(conversation.conversationId)?.betaWorkflow)
      .toMatchObject({
        status: "deferred",
        verifiedExecutions: [{ evidenceId: "failed-evidence" }],
        incompleteExecutionRecoveries: [{
          decision: "retry-later", evidenceId: "failed-evidence",
          sourceMessageId: offered.assistantMessageId,
        }],
      });
    await expect(controller.sendChoice(
      offered.plan.experience.choices[1], offered.assistantMessageId, "Context",
    )).rejects.toMatchObject({ code: "IAURA_BETA_CONFIRMATION_OUT_OF_SEQUENCE" });

    const resumeOffer = await controller.send("Resume the paused step", "Context");
    expect(resumeOffer.plan.experience.choices).toEqual([
      expect.objectContaining({
        confirmation: { kind: "beta-session-decision", decision: "start-now" },
      }),
    ]);
    now = "2026-08-13T12:06:00Z";
    const resumed = await controller.sendChoice(
      resumeOffer.plan.experience.choices[0], resumeOffer.assistantMessageId, "Context",
    );
    expect(resumed.plan.experience.choices).toEqual([]);
    expect(mocks.analyze).toHaveBeenLastCalledWith(expect.objectContaining({
      userContext: expect.stringContaining("Status: started"),
    }));
    expect(mocks.analyze).toHaveBeenLastCalledWith(expect.objectContaining({
      userContext: expect.not.stringContaining("Status: deferred"),
    }));
    expect(conversationRepository.getConversation(conversation.conversationId)?.betaWorkflow)
      .toMatchObject({
        status: "started",
        sessionDecision: { kind: "start-now", sourceMessageId: resumeOffer.assistantMessageId },
        verifiedExecutions: [{ evidenceId: "failed-evidence" }],
        incompleteExecutionRecoveries: [{
          decision: "retry-later", evidenceId: "failed-evidence",
        }],
      });
    await expect(controller.sendChoice(
      resumeOffer.plan.experience.choices[0], resumeOffer.assistantMessageId, "Context",
    )).rejects.toMatchObject({ code: "IAURA_BETA_CONFIRMATION_OUT_OF_SEQUENCE" });

    now = "2026-08-13T12:07:00Z";
    const resumedAttempt = await controller.send("The resumed attempt passed", "Context");
    expect(resumedAttempt.plan.betaExecutionEvaluation).toMatchObject({
      result: "passed", doneWhenSatisfied: true,
    });
    await controller.sendChoice(
      resumedAttempt.plan.experience.choices[0], resumedAttempt.assistantMessageId, "Context",
    );
    expect(conversationRepository.getConversation(conversation.conversationId)?.betaWorkflow)
      .toMatchObject({
        status: "evaluated",
        verifiedExecutions: [
          { evidenceId: "failed-evidence" },
          { result: "passed", doneWhenSatisfied: true },
        ],
      });
  });

  it.each([false, true])(
    "confirms session evaluation outcomeSatisfied=%s and closes only through a separate trusted choice",
    async (outcomeSatisfied) => {
      const projects = {
        getActiveProject: vi.fn(() => ({ id: "iaura", name: "IAURA" } as IAuraProject)),
      } as unknown as ProjectRepository;
      const conversation = conversationRepository.createConversation({
        conversationId: `session-review-${outcomeSatisfied}`, projectId: "iaura",
      }).conversation!;
      conversationRepository.appendMessage(conversation.conversationId, {
        messageId: "execution-report", role: "user", content: "The step passed.",
      });
      conversationRepository.appendMessage(conversation.conversationId, {
        messageId: "execution-evaluation", role: "assistant", content: "Step passed.",
        structuredResponse: {
          actionTypes: [], experienceKind: "decision", recommendedSurface: "presence",
          sourceUserMessageId: "execution-report",
          betaExecutionEvaluation: {
            result: "passed", observation: "The step passed", doneWhenSatisfied: true,
          },
        },
      });
      conversationRepository.updateConversationMetadata(conversation.conversationId, {
        betaWorkflow: {
          version: 1, status: "evaluated",
          confirmedContext: { goal: "G", blocker: "B", summary: "S", sourceMessageId: "c", confirmedAt: "2026-08-13T12:00:00Z" },
          confirmedOutcome: { outcome: "O", doneWhen: "D", sourceMessageId: "o", confirmedAt: "2026-08-13T12:01:00Z" },
          confirmedNextStep: { action: "A", whyNow: "W", result: "R", doneWhen: "D", sourceMessageId: "n", confirmedAt: "2026-08-13T12:02:00Z" },
          sessionDecision: { kind: "start-now", sourceMessageId: "d", decidedAt: "2026-08-13T12:03:00Z" },
          verifiedExecutions: [{ evidenceId: "e", result: "passed", observation: "The step passed", doneWhenSatisfied: true, sourceUserMessageId: "execution-report", sourceMessageId: "execution-evaluation", verifiedAt: "2026-08-13T12:04:00Z" }],
        },
      });
      const sessionPlan = parseAuraAssistantPlan({
        content: "Session review.",
        betaSessionEvaluation: { outcomeSatisfied, summary: "Session summary" },
        experience: {
          kind: "decision", title: "Session review", summary: "Review", phases: [],
          choices: [{ label: "Confirm", description: "Confirm", prompt: "Confirm review", confirmation: {
            kind: "beta-session-evaluation", outcomeSatisfied, summary: "Session summary",
          } }], recommendedSurface: "presence",
        },
      });
      const closePlan = parseAuraAssistantPlan({
        content: "Review confirmed.",
        experience: {
          kind: "decision", title: "Session", summary: "Confirmed", phases: [],
          choices: [{ label: "Cerrar sesión", description: "Close", prompt: "Close session", confirmation: {
            kind: "beta-session-closure",
          } }], recommendedSurface: "presence",
        },
      });
      mocks.analyze.mockReturnValue(cognitiveRequest);
      mocks.generateCognitiveResponse
        .mockResolvedValueOnce(sessionPlan)
        .mockResolvedValueOnce(closePlan)
        .mockResolvedValueOnce(createAssistantPlan("Closure acknowledged.", []));
      const controller = new ConversationController({
        conversations: conversationRepository, projects,
        contextRetriever: createContextRetriever(),
        now: () => "2026-08-13T12:05:00Z",
      });

      const provisional = await controller.send("Evaluate the session outcome.", "Context");
      expect(conversationRepository.getConversation(conversation.conversationId)?.betaWorkflow)
        .not.toHaveProperty("sessionEvaluation");
      const acknowledgment = await controller.sendChoice(
        sessionPlan.experience.choices[0], provisional.assistantMessageId, "Context",
      );
      expect(acknowledgment.plan).not.toHaveProperty("betaSessionEvaluation");
      expect(conversationRepository.getConversation(conversation.conversationId)?.betaWorkflow)
        .toMatchObject({
          status: "evaluated",
          sessionEvaluation: {
            outcomeSatisfied, summary: "Session summary",
            sourceMessageId: provisional.assistantMessageId,
          },
        });

      if (!outcomeSatisfied) {
        expect(acknowledgment.plan.experience.choices).toEqual([]);
        await expect(controller.sendChoice(
          closePlan.experience.choices[0], acknowledgment.assistantMessageId, "Context",
        )).rejects.toMatchObject({ code: "IAURA_BETA_CONFIRMATION_INVALID" });
        return;
      }

      expect(acknowledgment.plan.experience.choices[0].confirmation)
        .toEqual({ kind: "beta-session-closure" });
      const closure = await controller.sendChoice(
        closePlan.experience.choices[0], acknowledgment.assistantMessageId, "Context",
      );
      expect(closure.plan.experience.choices).toEqual([]);
      expect(conversationRepository.getConversation(conversation.conversationId)?.betaWorkflow)
        .toMatchObject({
          status: "closed",
          sessionClosure: { sourceMessageId: acknowledgment.assistantMessageId },
        });
      await expect(controller.sendChoice(
        closePlan.experience.choices[0], acknowledgment.assistantMessageId, "Context",
      )).rejects.toMatchObject({ code: "IAURA_BETA_CONFIRMATION_OUT_OF_SEQUENCE" });
    },
  );

  it("rejects replacing the confirmed next step after evaluation", async () => {
    const projects = { getActiveProject: vi.fn(() => ({ id: "iaura", name: "IAURA" } as IAuraProject)) } as unknown as ProjectRepository;
    const plan = parseAuraAssistantPlan({ content: "Another step.", betaNextStep: {
      action: "B", whyNow: "Now", result: "R2", doneWhen: "D2",
    }, experience: { kind: "decision", title: "Next", summary: "Next", phases: [], choices: [{
      label: "Confirm", description: "Confirm", prompt: "Continue", confirmation: {
        kind: "beta-next-step", action: "B", whyNow: "Now", result: "R2", doneWhen: "D2",
      },
    }], recommendedSurface: "presence" } });
    const conversation = conversationRepository.createConversation({ projectId: "iaura" }).conversation!;
    conversationRepository.appendMessage(conversation.conversationId, {
      messageId: "replacement", role: "assistant", content: plan.content,
      structuredResponse: assistantMessageMetadata(plan),
    });
    conversationRepository.updateConversationMetadata(conversation.conversationId, { betaWorkflow: {
      version: 1, status: "evaluated",
      confirmedContext: { goal: "G", blocker: "B", summary: "S", sourceMessageId: "c", confirmedAt: "2026-08-13T12:00:00Z" },
      confirmedOutcome: { outcome: "O", doneWhen: "D", sourceMessageId: "o", confirmedAt: "2026-08-13T12:01:00Z" },
      confirmedNextStep: { action: "A", whyNow: "W", result: "R", doneWhen: "D", sourceMessageId: "n", confirmedAt: "2026-08-13T12:02:00Z" },
      sessionDecision: { kind: "start-now", sourceMessageId: "d", decidedAt: "2026-08-13T12:03:00Z" },
    } });
    mocks.analyze.mockReturnValue(cognitiveRequest);
    mocks.generateCognitiveResponse.mockResolvedValue(plan);
    const controller = new ConversationController({
      conversations: conversationRepository, projects,
      contextRetriever: createContextRetriever(),
    });
    const displayed = await controller.send("What is next?", "Context");
    expect(displayed.plan).not.toHaveProperty("betaNextStep");
    expect(displayed.plan.experience.choices).toEqual([]);
    await expect(controller.sendChoice(plan.experience.choices[0], "replacement", "Context"))
      .rejects.toMatchObject({ code: "IAURA_BETA_CONFIRMATION_INVALID" });
  });

  it("rejects evaluation whose application-bound founder report is missing", async () => {
    const projects = { getActiveProject: vi.fn(() => ({ id: "iaura", name: "IAURA" } as IAuraProject)) } as unknown as ProjectRepository;
    const plan = parseAuraAssistantPlan({ content: "Review.", betaExecutionEvaluation: {
      result: "partial", observation: "Observed", doneWhenSatisfied: false,
    }, experience: { kind: "decision", title: "E", summary: "E", phases: [], choices: [{
      label: "Confirm", description: "Confirm", prompt: "Continue", confirmation: {
        kind: "beta-execution-evaluation", result: "partial", observation: "Observed", doneWhenSatisfied: false,
      },
    }], recommendedSurface: "presence" } });
    const conversation = conversationRepository.createConversation({ projectId: "iaura" }).conversation!;
    conversationRepository.updateConversationMetadata(conversation.conversationId, { betaWorkflow: {
      version: 1, status: "started",
      confirmedContext: { goal: "G", blocker: "B", summary: "S", sourceMessageId: "c", confirmedAt: "2026-08-13T12:00:00Z" },
      confirmedOutcome: { outcome: "O", doneWhen: "D", sourceMessageId: "o", confirmedAt: "2026-08-13T12:01:00Z" },
      confirmedNextStep: { action: "A", whyNow: "W", result: "R", doneWhen: "D", sourceMessageId: "n", confirmedAt: "2026-08-13T12:02:00Z" },
      sessionDecision: { kind: "start-now", sourceMessageId: "d", decidedAt: "2026-08-13T12:03:00Z" },
    } });
    conversationRepository.appendMessage(conversation.conversationId, {
      messageId: "evaluation-without-user", role: "assistant", content: "Review.",
      structuredResponse: assistantMessageMetadata(plan, "missing-user"),
    });
    await expect(new ConversationController({ conversations: conversationRepository, projects })
      .sendChoice(plan.experience.choices[0], "evaluation-without-user", "Context"))
      .rejects.toMatchObject({ code: "IAURA_BETA_CONFIRMATION_INVALID" });
  });

  it("allows deferred to restart only through an exact persisted start choice", async () => {
    const projects = { getActiveProject: vi.fn(() => ({ id: "iaura", name: "IAURA" } as IAuraProject)) } as unknown as ProjectRepository;
    const plan = parseAuraAssistantPlan({ content: "Start?", experience: {
      kind: "decision", title: "Start", summary: "Start", phases: [], choices: [{
        label: "Empezar ahora", description: "Start", prompt: "Start", confirmation: {
          kind: "beta-session-decision", decision: "start-now",
        },
      }], recommendedSurface: "presence",
    } });
    const conversation = conversationRepository.createConversation({ projectId: "iaura" }).conversation!;
    conversationRepository.updateConversationMetadata(conversation.conversationId, { betaWorkflow: {
      version: 1, status: "deferred",
      confirmedContext: { goal: "G", blocker: "B", summary: "S", sourceMessageId: "c", confirmedAt: "2026-08-13T12:00:00Z" },
      confirmedOutcome: { outcome: "O", doneWhen: "D", sourceMessageId: "o", confirmedAt: "2026-08-13T12:01:00Z" },
      confirmedNextStep: { action: "A", whyNow: "W", result: "R", doneWhen: "D", sourceMessageId: "n", confirmedAt: "2026-08-13T12:02:00Z" },
      sessionDecision: { kind: "continue-later", sourceMessageId: "old", decidedAt: "2026-08-13T12:03:00Z" },
    } });
    conversationRepository.appendMessage(conversation.conversationId, {
      messageId: "restart", role: "assistant", content: "Start?",
      structuredResponse: assistantMessageMetadata(plan),
    });
    mocks.analyze.mockReturnValue(cognitiveRequest);
    mocks.generateCognitiveResponse.mockResolvedValue(createAssistantPlan("Started.", []));
    await new ConversationController({ conversations: conversationRepository, projects })
      .sendChoice(plan.experience.choices[0], "restart", "Context");
    expect(conversationRepository.getConversation(conversation.conversationId)?.betaWorkflow)
      .toMatchObject({ status: "started", sessionDecision: { kind: "start-now", sourceMessageId: "restart" } });
  });

  it.each(["finish-here", "begin-another-cycle"] as const)(
    "persists trusted post-closure handoff %s without reopening history",
    async (decision) => {
      const projects = { getActiveProject: vi.fn(() => ({ id: "iaura", name: "IAURA" } as IAuraProject)) } as unknown as ProjectRepository;
      const handoffPlan = parseAuraAssistantPlan({ content: "Choose.", experience: {
        kind: "decision", title: "Closed", summary: "Choose", phases: [],
        choices: [{ label: decision, description: "Choose", prompt: "Continue",
          confirmation: { kind: "beta-post-closure-handoff", decision } }],
        recommendedSurface: "presence",
      } });
      const conversation = conversationRepository.createConversation({ projectId: "iaura" }).conversation!;
      const sourcePlans = [
        ["c", parseAuraAssistantPlan({ content: "Context", experience: { kind: "decision", title: "Context", summary: "Context", phases: [], choices: [{ label: "Confirm", description: "Confirm", prompt: "Continue", confirmation: { kind: "beta-context", goal: "G", blocker: "B", summary: "S" } }], recommendedSurface: "presence" } })],
        ["o", parseAuraAssistantPlan({ content: "Outcome", experience: { kind: "decision", title: "Outcome", summary: "Outcome", phases: [], choices: [{ label: "Confirm", description: "Confirm", prompt: "Continue", confirmation: { kind: "beta-outcome", outcome: "O", doneWhen: "D" } }], recommendedSurface: "presence" } })],
        ["n", parseAuraAssistantPlan({ content: "Next", betaNextStep: { action: "A", whyNow: "W", result: "R", doneWhen: "D" }, experience: { kind: "decision", title: "Next", summary: "Next", phases: [], choices: [{ label: "Confirm", description: "Confirm", prompt: "Continue", confirmation: { kind: "beta-next-step", action: "A", whyNow: "W", result: "R", doneWhen: "D" } }], recommendedSurface: "presence" } })],
        ["d", parseAuraAssistantPlan({ content: "Start", experience: { kind: "decision", title: "Start", summary: "Start", phases: [], choices: [{ label: "Start", description: "Start", prompt: "Continue", confirmation: { kind: "beta-session-decision", decision: "start-now" } }], recommendedSurface: "presence" } })],
      ] as const;
      for (const [messageId, plan] of sourcePlans) {
        conversationRepository.appendMessage(conversation.conversationId, {
          messageId, role: "assistant", content: plan.content,
          structuredResponse: assistantMessageMetadata(plan),
        });
      }
      conversationRepository.appendMessage(conversation.conversationId, {
        messageId: "report", role: "user", content: "Passed.",
      });
      conversationRepository.appendMessage(conversation.conversationId, {
        messageId: "execution", role: "assistant", content: "Passed.", structuredResponse: {
          actionTypes: [], experienceKind: "decision", recommendedSurface: "presence",
          sourceUserMessageId: "report",
          betaExecutionEvaluation: { result: "passed", observation: "Passed", doneWhenSatisfied: true },
        },
      });
      conversationRepository.appendMessage(conversation.conversationId, {
        messageId: "review", role: "assistant", content: "Satisfied.", structuredResponse: {
          actionTypes: [], experienceKind: "decision", recommendedSurface: "presence",
          betaSessionEvaluation: { outcomeSatisfied: true, summary: "Satisfied" },
        },
      });
      conversationRepository.appendMessage(conversation.conversationId, {
        messageId: "close-choice", role: "assistant", content: "Close?", structuredResponse: assistantMessageMetadata(parseAuraAssistantPlan({
          content: "Close?", experience: { kind: "decision", title: "Close", summary: "Close", phases: [],
            choices: [{ label: "Close", description: "Close", prompt: "Close", confirmation: { kind: "beta-session-closure" } }], recommendedSurface: "presence" },
        })),
      });
      conversationRepository.appendMessage(conversation.conversationId, {
        messageId: "handoff", role: "assistant", content: "Choose.",
        structuredResponse: assistantMessageMetadata(handoffPlan),
      });
      conversationRepository.updateConversationMetadata(conversation.conversationId, { betaWorkflow: {
        version: 1, status: "closed",
        confirmedContext: { goal: "G", blocker: "B", summary: "S", sourceMessageId: "c", confirmedAt: "2026-08-13T12:00:00Z" },
        confirmedOutcome: { outcome: "O", doneWhen: "D", sourceMessageId: "o", confirmedAt: "2026-08-13T12:01:00Z" },
        confirmedNextStep: { action: "A", whyNow: "W", result: "R", doneWhen: "D", sourceMessageId: "n", confirmedAt: "2026-08-13T12:02:00Z" },
        sessionDecision: { kind: "start-now", sourceMessageId: "d", decidedAt: "2026-08-13T12:03:00Z" },
        verifiedExecutions: [{ evidenceId: "e", result: "passed", observation: "Passed", doneWhenSatisfied: true, sourceUserMessageId: "report", sourceMessageId: "execution", verifiedAt: "2026-08-13T12:04:00Z" }],
        sessionEvaluation: { outcomeSatisfied: true, summary: "Satisfied", sourceMessageId: "review", confirmedAt: "2026-08-13T12:05:00Z" },
        sessionClosure: { sourceMessageId: "close-choice", closedAt: "2026-08-13T12:06:00Z" },
      } });
      mocks.analyze.mockReturnValue(cognitiveRequest);
      mocks.generateCognitiveResponse.mockResolvedValue({
        ...handoffPlan,
        content: "Acknowledged.",
      });
      const controller = new ConversationController({ conversations: conversationRepository, projects, now: () => "2026-08-13T12:07:00Z" });

      const acknowledgment = await controller.sendChoice(
        handoffPlan.experience.choices[0], "handoff", "Context",
      );
      expect(acknowledgment.plan.experience.choices).toEqual([]);
      const restored = conversationRepository.getConversation(conversation.conversationId)!;
      if (decision === "finish-here") {
        expect(restored.betaWorkflow).toMatchObject({ status: "closed", postClosureHandoff: { decision, sourceMessageId: "handoff" } });
        expect(restored.completedBetaWorkflows).toBeUndefined();
        expect(mocks.analyze).toHaveBeenLastCalledWith(expect.objectContaining({
          userContext: expect.stringContaining(
            "Founder explicitly chose to finish here. The handoff is complete",
          ),
        }));
      } else {
        expect(restored.betaWorkflow).toBeUndefined();
        expect(restored.completedBetaWorkflows).toHaveLength(1);
        expect(restored.completedBetaWorkflows?.[0]).toMatchObject({
          status: "closed", postClosureHandoff: { decision, sourceMessageId: "handoff" },
          verifiedExecutions: [{ evidenceId: "e" }],
        });
        expect(mocks.analyze).toHaveBeenLastCalledWith(expect.objectContaining({
          userContext: expect.stringContaining(
            "Active workflow: none. A fresh Beta cycle may begin only through new context confirmation.",
          ),
        }));
      }
      const ordinary = await controller.send("Continue normal conversation", "Context");
      expect(ordinary.plan.experience.choices).toEqual([]);
      await expect(controller.sendChoice(handoffPlan.experience.choices[0], "handoff", "Context"))
        .rejects.toMatchObject({ code: "IAURA_BETA_CONFIRMATION_INVALID" });
    },
  );

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

  it.each(["normal", "retry-later"] as const)(
    "directly resumes trusted deferred continuity for %s provenance once",
    async (kind) => {
      const project = { id: `continuity-${kind}`, name: "Continuity" } as IAuraProject;
      const projects = {
        getActiveProject: vi.fn(() => project),
      } as unknown as ProjectRepository;
      const created = conversationRepository.createConversation({
        conversationId: `continuity-${kind}`, projectId: project.id,
      }).conversation!;
      if (kind === "retry-later") {
        conversationRepository.appendMessage(created.conversationId, {
          messageId: "report", role: "user", content: "Partial.",
        });
        conversationRepository.appendMessage(created.conversationId, {
          messageId: "evaluation", role: "assistant", content: "Partial.",
          structuredResponse: {
            actionTypes: [], experienceKind: "decision", recommendedSurface: "presence",
            sourceUserMessageId: "report",
            betaExecutionEvaluation: {
              result: "partial", observation: "Partial", doneWhenSatisfied: false,
            },
          },
        });
        conversationRepository.appendMessage(created.conversationId, {
          messageId: "recovery", role: "assistant", content: "Recover.",
          structuredResponse: {
            actionTypes: [], experienceKind: "decision", recommendedSurface: "presence",
            experience: {
              kind: "decision", title: "Recovery", summary: "Choose", phases: [],
              choices: [{ label: "Continuar después", description: "Later", prompt: "Later", confirmation: {
                kind: "beta-incomplete-execution-recovery", decision: "retry-later",
              } }], recommendedSurface: "presence",
            },
          },
        });
      }
      conversationRepository.updateConversationMetadata(created.conversationId, {
        betaWorkflow: {
          version: 1, status: "deferred",
          confirmedContext: { goal: "G", blocker: "B", summary: "S", sourceMessageId: "context", confirmedAt: "2026-08-14T10:00:00Z" },
          confirmedOutcome: { outcome: "O", doneWhen: "D", sourceMessageId: "outcome", confirmedAt: "2026-08-14T10:01:00Z" },
          confirmedNextStep: { action: "Same step", whyNow: "Now", result: "R", doneWhen: "D", sourceMessageId: "step", confirmedAt: "2026-08-14T10:02:00Z" },
          sessionDecision: kind === "normal"
            ? { kind: "continue-later", sourceMessageId: "defer", decidedAt: "2026-08-14T10:03:00Z" }
            : { kind: "start-now", sourceMessageId: "start", decidedAt: "2026-08-14T10:03:00Z" },
          ...(kind === "retry-later"
            ? {
                verifiedExecutions: [{ evidenceId: "partial", result: "partial", observation: "Partial", doneWhenSatisfied: false, sourceUserMessageId: "report", sourceMessageId: "evaluation", verifiedAt: "2026-08-14T10:04:00Z" }],
                incompleteExecutionRecoveries: [{ decision: "retry-later", evidenceId: "partial", sourceMessageId: "recovery", confirmedAt: "2026-08-14T10:05:00Z" }],
              }
            : {}),
        },
      });
      const before = conversationRepository.getConversation(created.conversationId)!;
      const controller = new ConversationController({
        conversations: conversationRepository, projects,
        contextRetriever: createContextRetriever(),
        now: () => "2026-08-14T10:06:00Z",
      });
      const request = {
        projectId: project.id,
        conversationId: before.conversationId,
        expectedRevision: before.revision,
        stepSourceMessageId: "step",
        deferSourceMessageId: kind === "normal" ? "defer" : "recovery",
      };

      const resumed = controller.resumeDeferredFromContinuity(request);
      expect(resumed.betaWorkflow).toMatchObject({
        status: "started",
        confirmedNextStep: { action: "Same step", sourceMessageId: "step" },
        sessionDecision: { kind: "start-now" },
      });
      const resumeSource = resumed.messages.find(
        (message) =>
          message.messageId === resumed.betaWorkflow?.sessionDecision?.sourceMessageId,
      );
      expect(resumeSource?.structuredResponse?.experience?.choices).toContainEqual(
        expect.objectContaining({
          confirmation: { kind: "beta-session-decision", decision: "start-now" },
        }),
      );
      expect(resumed.betaWorkflow?.verifiedExecutions ?? []).toHaveLength(
        kind === "retry-later" ? 1 : 0,
      );
      expect(resumed.betaWorkflow?.incompleteExecutionRecoveries ?? []).toHaveLength(
        kind === "retry-later" ? 1 : 0,
      );
      expect(() => controller.resumeDeferredFromContinuity(request))
        .toThrow(expect.objectContaining({ code: "IAURA_BETA_CONFIRMATION_OUT_OF_SEQUENCE" }));

      const evaluationPlan = parseAuraAssistantPlan({
        content: "Review the resumed execution.",
        betaExecutionEvaluation: {
          result: "passed", observation: "Resumed report", doneWhenSatisfied: false,
        },
        experience: {
          kind: "decision", title: "Evaluation", summary: "Review", phases: [],
          choices: [{ label: "Confirm", description: "Confirm", prompt: "Confirm", confirmation: {
            kind: "beta-execution-evaluation", result: "passed",
            observation: "Resumed report", doneWhenSatisfied: false,
          } }], recommendedSurface: "presence",
        },
      });
      mocks.analyze.mockReturnValue(cognitiveRequest);
      mocks.generateCognitiveResponse.mockResolvedValueOnce(evaluationPlan);
      const reported = await controller.send("New resumed execution report", "Context");
      expect(reported.plan.betaExecutionEvaluation).toEqual({
        result: "passed", observation: "Resumed report", doneWhenSatisfied: false,
      });
    },
  );

  it("rejects stale, cross-project, historical, closed, and absent continuity resume state", () => {
    const project = { id: "continuity-guards", name: "Continuity" } as IAuraProject;
    const getActiveProject = vi.fn(() => project);
    const projects = { getActiveProject } as unknown as ProjectRepository;
    const created = conversationRepository.createConversation({
      conversationId: "continuity-guards", projectId: project.id,
    }).conversation!;
    conversationRepository.updateConversationMetadata(created.conversationId, {
      betaWorkflow: {
        version: 1, status: "deferred",
        confirmedContext: { goal: "G", blocker: "B", summary: "S", sourceMessageId: "context", confirmedAt: "2026-08-14T10:00:00Z" },
        confirmedOutcome: { outcome: "O", doneWhen: "D", sourceMessageId: "outcome", confirmedAt: "2026-08-14T10:01:00Z" },
        confirmedNextStep: { action: "Same step", whyNow: "Now", result: "R", doneWhen: "D", sourceMessageId: "step", confirmedAt: "2026-08-14T10:02:00Z" },
        sessionDecision: { kind: "continue-later", sourceMessageId: "defer", decidedAt: "2026-08-14T10:03:00Z" },
      },
    });
    const current = conversationRepository.getConversation(created.conversationId)!;
    const controller = new ConversationController({
      conversations: conversationRepository, projects,
      contextRetriever: createContextRetriever(),
    });
    const valid = {
      projectId: project.id, conversationId: current.conversationId,
      expectedRevision: current.revision, stepSourceMessageId: "step",
      deferSourceMessageId: "defer",
    };

    expect(() => controller.resumeDeferredFromContinuity({
      ...valid, expectedRevision: current.revision - 1,
    })).toThrow(expect.objectContaining({ code: "IAURA_BETA_CONFIRMATION_OUT_OF_SEQUENCE" }));
    getActiveProject.mockReturnValue({ id: "other", name: "Other" } as IAuraProject);
    expect(() => controller.resumeDeferredFromContinuity(valid))
      .toThrow(expect.objectContaining({ code: "IAURA_BETA_CONFIRMATION_OUT_OF_SEQUENCE" }));
    getActiveProject.mockReturnValue(project);
    conversationRepository.updateConversationMetadata(created.conversationId, {
      betaWorkflow: { ...current.betaWorkflow!, status: "closed" },
    });
    expect(() => controller.resumeDeferredFromContinuity({
      ...valid,
      expectedRevision: conversationRepository.getConversation(created.conversationId)!.revision,
    })).toThrow(expect.objectContaining({ code: "IAURA_BETA_CONFIRMATION_OUT_OF_SEQUENCE" }));
    conversationRepository.updateConversationMetadata(created.conversationId, { betaWorkflow: null });
    expect(() => controller.resumeDeferredFromContinuity({
      ...valid,
      expectedRevision: conversationRepository.getConversation(created.conversationId)!.revision,
    })).toThrow(expect.objectContaining({ code: "IAURA_BETA_CONFIRMATION_OUT_OF_SEQUENCE" }));
  });

  it("threads authenticated identity and exact active-project Intelligence into read-only context", async () => {
    const project = {
      id: "project-a",
      name: "VAEORA",
      goal: "Ship the primary objective",
    } as IAuraProject;
    const projects = { getActiveProject: vi.fn(() => project) } as unknown as ProjectRepository;
    const conversations = new LocalConversationRepository({ synchronize: false, persistLocally: false });
    const contextRetriever = createContextRetriever();
    const intelligenceContextSource = {
      loadContextProjection: vi.fn(async () => ({
        global: {
          direction: { recordId: "direction-a", updatedAt: "2026-08-21T00:00:00Z", content: "Build a disciplined life" },
          priorities: [{ recordId: "priority-a", updatedAt: "2026-08-21T00:00:00Z", goalId: null, position: 1, label: "Build VAEORA", source: "title" as const }],
          goals: [],
          recurringCommitments: [],
        },
        project: {
          projectId: "project-a",
          projectGoal: "Ship the primary objective",
          direction: null,
          priorities: [],
          goals: [{ recordId: "goal-a", updatedAt: "2026-08-21T00:00:00Z", title: "Project A additional goal", targetDate: null }],
          recurringCommitments: [],
        },
      })),
    };
    mocks.analyze.mockReturnValue(cognitiveRequest);
    mocks.generateCognitiveResponse.mockResolvedValue(createAssistantPlan("Aware", []));

    await new ConversationController({
      conversations,
      projects,
      contextRetriever,
      intelligenceContextSource,
      authenticatedUserId: () => "authenticated-user-a",
    }).send("What matters?", "Identity and project preferences");

    expect(contextRetriever.retrieve).toHaveBeenCalledWith(expect.objectContaining({
      userId: "authenticated-user-a",
      projectId: "project-a",
    }));
    expect(intelligenceContextSource.loadContextProjection).toHaveBeenCalledWith(project);
    expect(mocks.analyze).toHaveBeenCalledWith(expect.objectContaining({
      userContext: expect.stringContaining('<user_intelligence trust="user-context-data" access="read-only">'),
    }));
    const submitted = mocks.analyze.mock.calls.at(-1)?.[0].userContext as string;
    expect(submitted).toContain("Project Primary Objective (authoritative)");
    expect(submitted).toContain("Project A additional goal");
    expect(submitted).not.toContain("Memory.goals");
    expect(mocks.executeMemoryUpdates).toHaveBeenCalledWith([], "project-a");
  });

  it("binds Intelligence bridges to stable project IDs across A to B to A switching", async () => {
    const projectA = { id: "stable-a", name: "Same display name", goal: "A" } as IAuraProject;
    const projectB = { id: "stable-b", name: "Same display name", goal: "B" } as IAuraProject;
    let activeProject = projectA;
    const projects = {
      getActiveProject: vi.fn(() => activeProject),
      getProject: vi.fn((id: string) => [projectA, projectB].find((project) => project.id === id) ?? null),
      getProjects: vi.fn(() => [projectA, projectB]),
    } as unknown as ProjectRepository;
    const conversations = new LocalConversationRepository({ synchronize: false, persistLocally: false });
    const controller = new ConversationController({ conversations, projects, contextRetriever: createContextRetriever() });
    mocks.analyze.mockReturnValue(cognitiveRequest);
    mocks.generateCognitiveResponse.mockResolvedValue(createAssistantPlan("Scoped", []));

    await controller.send("Manage A", "Context", { scopeType: "project", projectId: "stable-a" });
    activeProject = projectB;
    await controller.send("Manage B", "Context", { scopeType: "project", projectId: "stable-b" });
    activeProject = projectA;
    await controller.send("Manage A again", "Context", { scopeType: "project", projectId: "stable-a" });

    expect(conversations.listConversations().map((item) => item.projectId).sort()).toEqual(["stable-a", "stable-b"]);
    const submitted = mocks.analyze.mock.calls.slice(-3).map((call) => call[0].userContext as string);
    expect(submitted[0]).toContain("Captured project id: stable-a");
    expect(submitted[1]).toContain("Captured project id: stable-b");
    expect(submitted[2]).toContain("Captured project id: stable-a");
  });

  it("rejects stale cross-project bridge authority before generation and keeps global bridges global", async () => {
    const activeProject = { id: "project-b", name: "Proyecto A" } as IAuraProject;
    const projects = { getActiveProject: vi.fn(() => activeProject) } as unknown as ProjectRepository;
    const controller = new ConversationController({
      conversations: new LocalConversationRepository({ synchronize: false, persistLocally: false }),
      projects,
      contextRetriever: createContextRetriever(),
    });
    mocks.analyze.mockReturnValue(cognitiveRequest);
    mocks.generateCognitiveResponse.mockResolvedValue(createAssistantPlan("Scoped", []));
    const callsBefore = mocks.analyze.mock.calls.length;

    await expect(controller.send("Scope: project Proyecto A", "Context", {
      scopeType: "project", projectId: "project-a",
    })).rejects.toMatchObject({ code: "IAURA_INTELLIGENCE_BRIDGE_STALE" });
    expect(mocks.analyze.mock.calls.length).toBe(callsBefore);

    const globalResult = await controller.send("Manage global priorities", "Context", { scopeType: "global", projectId: null });
    const submitted = mocks.analyze.mock.calls.at(-1)?.[0].userContext as string;
    expect(submitted).toContain("Requested scope: GLOBAL");
    expect(submitted).toContain("Captured project id: none");
    expect(globalResult.plan.content).toBe("Scoped");
  });

  it("continues safely with no stale Intelligence when canonical retrieval fails", async () => {
    const project = { id: "project-a", name: "VAEORA", goal: "Primary survives" } as IAuraProject;
    const projects = { getActiveProject: vi.fn(() => project) } as unknown as ProjectRepository;
    const conversations = new LocalConversationRepository({ synchronize: false, persistLocally: false });
    const warning = vi.spyOn(console, "warn").mockImplementation(() => undefined);
    mocks.analyze.mockReturnValue(cognitiveRequest);
    mocks.generateCognitiveResponse.mockResolvedValue(createAssistantPlan("Continued", []));

    await expect(new ConversationController({
      conversations,
      projects,
      contextRetriever: createContextRetriever(),
      intelligenceContextSource: {
        loadContextProjection: vi.fn().mockRejectedValue(new Error("read unavailable")),
      },
      authenticatedUserId: () => "authenticated-user-a",
    }).send("Continue", "Existing safe context")).resolves.toMatchObject({
      plan: { content: "Continued" },
    });

    const submitted = mocks.analyze.mock.calls.at(-1)?.[0].userContext as string;
    expect(submitted).toContain("Primary survives");
    expect(submitted).not.toContain("Project B");
    expect(warning).toHaveBeenCalledWith(
      expect.stringContaining("continuing without canonical Intelligence"),
      "read unavailable",
    );
  });

  it("executes an exact persisted Intelligence confirmation once and persists its receipt", async () => {
    const conversations = new LocalConversationRepository({ synchronize: false, persistLocally: false });
    const proposal = {
      operation: "intelligence_create_goal" as const, scopeType: "global" as const,
      projectId: null, expectedActiveProjectId: null, projectName: null,
      currentSummary: "None", proposedSummary: "Goal: Finish Intelligence v2", title: "Finish Intelligence v2",
    };
    const confirm = { label: "Confirm", description: "Create it", prompt: "Confirm", confirmation: { kind: "intelligence-action" as const, decision: "confirm" as const, proposal } };
    const cancel = { ...confirm, label: "Cancel", prompt: "Cancel", confirmation: { ...confirm.confirmation, decision: "cancel" as const } };
    const plan = parseAuraAssistantPlan({ content: "Proposed", actions: [], memoryUpdates: [], experience: {
      kind: "decision", title: "Create goal", summary: "Review", phases: [], choices: [confirm, cancel], recommendedSurface: "intelligence",
    } });
    const executor = { execute: vi.fn().mockResolvedValue({
      receiptId: "receipt-a", sourceMessageId: "source", operation: proposal.operation,
      scopeType: "global", projectId: null, status: "executed", summary: "Verified goal creation",
    }) };
    mocks.analyze.mockReturnValue(cognitiveRequest);
    mocks.generateCognitiveResponse.mockResolvedValue(plan);
    const controller = new ConversationController({ conversations, contextRetriever: createContextRetriever(), intelligenceActionExecutor: executor });
    const proposed = await controller.send("Create it", "Context");
    const persistedChoice = conversations.getConversation(conversations.getSnapshot().activeConversationId!)!
      .messages.find((message) => message.messageId === proposed.assistantMessageId)!.structuredResponse!.experience!.choices[0];

    expect(persistedChoice.confirmation?.kind === "intelligence-action" && persistedChoice.confirmation.proposal.executionId)
      .toMatch(/^[0-9a-f-]{36}$/i);
    const immediatelyRenderedChoice = proposed.plan.experience.choices[0];
    expect(immediatelyRenderedChoice).toEqual(persistedChoice);

    const confirmed = await controller.sendChoice(immediatelyRenderedChoice, proposed.assistantMessageId, "Context");
    const duplicate = await controller.sendChoice(immediatelyRenderedChoice, proposed.assistantMessageId, "Context");

    expect(executor.execute).toHaveBeenCalledTimes(1);
    expect(confirmed.plan.content).toContain("Status: executed");
    expect(duplicate.assistantMessageId).toBe(confirmed.assistantMessageId);
    expect(mocks.executeMemoryUpdates).toHaveBeenLastCalledWith([], undefined);
  });

  it("does not return an executable Intelligence proposal until its authoritative assistant snapshot is persisted", async () => {
    const conversations = new AuthenticatedConversationRepository();
    conversations.configure("user-a", null);
    let remoteSnapshot: ReturnType<typeof conversations.getSnapshot> | null = null;
    const fetchMock = vi.fn(async (_url: string, init?: RequestInit) => {
      const body = JSON.parse(String(init?.body)) as { snapshot: ReturnType<typeof conversations.getSnapshot> };
      remoteSnapshot = body.snapshot;
      return { ok: true };
    });
    vi.stubGlobal("fetch", fetchMock);
    const proposal = {
      operation: "intelligence_create_priority" as const, scopeType: "global" as const,
      projectId: null, expectedActiveProjectId: null, projectName: null,
      currentSummary: "None", proposedSummary: "Add Finish Intelligence v2 as a global priority.",
      title: "Finish Intelligence v2", goalId: null,
    };
    const confirm = { label: "Confirm", description: "Create", prompt: "Confirm", confirmation: { kind: "intelligence-action" as const, decision: "confirm" as const, proposal } };
    const cancel = { ...confirm, label: "Cancel", prompt: "Cancel", confirmation: { ...confirm.confirmation, decision: "cancel" as const } };
    mocks.analyze.mockReturnValue(cognitiveRequest);
    mocks.generateCognitiveResponse.mockResolvedValue(parseAuraAssistantPlan({ content: "Proposed", actions: [], memoryUpdates: [], experience: {
      kind: "decision", title: "Priority", summary: "Review", phases: [], choices: [confirm, cancel], recommendedSurface: "intelligence",
    } }));
    const controller = new ConversationController({ conversations, contextRetriever: createContextRetriever() });

    const proposed = await controller.send("Make it a priority", "Context");
    const persistedSource = remoteSnapshot!.conversations.flatMap((conversation) => conversation.messages)
      .find((message) => message.messageId === proposed.assistantMessageId);

    expect(fetchMock).toHaveBeenCalledTimes(3);
    expect(persistedSource?.structuredResponse?.experience?.choices).toEqual(proposed.plan.experience.choices);
    expect(proposed.plan.experience.choices[0].confirmation?.kind === "intelligence-action" &&
      proposed.plan.experience.choices[0].confirmation.proposal.executionId).toMatch(/^[0-9a-f-]{36}$/i);
  });

  it("coalesces concurrent confirmations for the same persisted Intelligence proposal", async () => {
    const conversations = new LocalConversationRepository({ synchronize: false, persistLocally: false });
    const proposal = {
      operation: "intelligence_create_goal" as const, scopeType: "global" as const,
      projectId: null, expectedActiveProjectId: null, projectName: null,
      currentSummary: "None", proposedSummary: "Goal: Finish Intelligence v2", title: "Finish Intelligence v2",
    };
    const confirm = { label: "Confirm", description: "Create it", prompt: "Confirm", confirmation: { kind: "intelligence-action" as const, decision: "confirm" as const, proposal } };
    const cancel = { ...confirm, label: "Cancel", prompt: "Cancel", confirmation: { ...confirm.confirmation, decision: "cancel" as const } };
    const plan = parseAuraAssistantPlan({ content: "Proposed", actions: [], memoryUpdates: [], experience: {
      kind: "decision", title: "Create goal", summary: "Review", phases: [], choices: [confirm, cancel], recommendedSurface: "intelligence",
    } });
    let finishExecution!: (value: IntelligenceActionReceipt) => void;
    const executor = { execute: vi.fn(() => new Promise<IntelligenceActionReceipt>((resolve) => { finishExecution = resolve; })) };
    mocks.analyze.mockReturnValue(cognitiveRequest);
    mocks.generateCognitiveResponse.mockResolvedValue(plan);
    const controller = new ConversationController({ conversations, contextRetriever: createContextRetriever(), intelligenceActionExecutor: executor });
    const proposed = await controller.send("Create it", "Context");
    const persistedChoice = conversations.getConversation(conversations.getSnapshot().activeConversationId!)!
      .messages.find((message) => message.messageId === proposed.assistantMessageId)!.structuredResponse!.experience!.choices[0];

    const first = controller.sendChoice(persistedChoice, proposed.assistantMessageId, "Context");
    const second = controller.sendChoice(persistedChoice, proposed.assistantMessageId, "Context");
    await vi.waitFor(() => expect(executor.execute).toHaveBeenCalledTimes(1));
    finishExecution({
      receiptId: "receipt-concurrent", sourceMessageId: proposed.assistantMessageId,
      operation: proposal.operation, scopeType: "global", projectId: null,
      status: "executed", summary: "Verified goal creation",
    });
    const [firstResult, secondResult] = await Promise.all([first, second]);

    expect(firstResult.assistantMessageId).toBe(secondResult.assistantMessageId);
    expect(executor.execute).toHaveBeenCalledTimes(1);
  });

  it("reconciles a stale-tab CAS conflict only when the exact persisted Intelligence proposal remains authoritative", async () => {
    const conversations = new LocalConversationRepository({ synchronize: false, persistLocally: false });
    const proposal = {
      operation: "intelligence_create_priority" as const, scopeType: "global" as const,
      projectId: null, expectedActiveProjectId: null, projectName: null,
      currentSummary: "None", proposedSummary: "Finish Intelligence v2 is a global priority.",
      title: "Finish Intelligence v2", goalId: null,
    };
    const confirm = { label: "Confirm", description: "Create", prompt: "Confirm", confirmation: { kind: "intelligence-action" as const, decision: "confirm" as const, proposal } };
    const cancel = { ...confirm, label: "Cancel", prompt: "Cancel", confirmation: { ...confirm.confirmation, decision: "cancel" as const } };
    const plan = parseAuraAssistantPlan({ content: "Proposed", actions: [], memoryUpdates: [], experience: {
      kind: "decision", title: "Create priority", summary: "Review", phases: [], choices: [confirm, cancel], recommendedSurface: "intelligence",
    } });
    const executor = { execute: vi.fn().mockResolvedValue({
      receiptId: "receipt-safe-retry", sourceMessageId: "source", operation: proposal.operation,
      scopeType: "global", projectId: null, status: "executed", summary: "Verified priority creation",
    }) };
    mocks.analyze.mockReturnValue(cognitiveRequest);
    mocks.generateCognitiveResponse.mockResolvedValue(plan);
    const controller = new ConversationController({ conversations, contextRetriever: createContextRetriever(), intelligenceActionExecutor: executor });
    const proposed = await controller.send("Make it a priority", "Context");
    const authoritativeSnapshot = conversations.getSnapshot();
    const persistedChoice = conversations.getConversation(authoritativeSnapshot.activeConversationId!)!
      .messages.find((message) => message.messageId === proposed.assistantMessageId)!.structuredResponse!.experience!.choices[0];
    const flush = vi.fn()
      .mockImplementationOnce(async () => {
        conversations.replaceSnapshotResult(authoritativeSnapshot);
        throw new AuthenticatedConversationPersistenceError("IAURA_STATE_STALE_WRITE");
      })
      .mockResolvedValue(undefined);
    Object.assign(conversations, { flush });

    const result = await controller.sendChoice(persistedChoice, proposed.assistantMessageId, "Context");

    expect(result.plan.content).toContain("Status: executed");
    expect(executor.execute).toHaveBeenCalledTimes(1);
    expect(flush).toHaveBeenCalledTimes(3);
  });

  it("rejects a stale-tab Intelligence confirmation with zero writes when remote authority lost the source proposal", async () => {
    const conversations = new LocalConversationRepository({ synchronize: false, persistLocally: false });
    const proposal = {
      operation: "intelligence_create_goal" as const, scopeType: "global" as const,
      projectId: null, expectedActiveProjectId: null, projectName: null,
      currentSummary: "None", proposedSummary: "Goal", title: "Goal",
    };
    const confirm = { label: "Confirm", description: "Create", prompt: "Confirm", confirmation: { kind: "intelligence-action" as const, decision: "confirm" as const, proposal } };
    const cancel = { ...confirm, label: "Cancel", prompt: "Cancel", confirmation: { ...confirm.confirmation, decision: "cancel" as const } };
    mocks.analyze.mockReturnValue(cognitiveRequest);
    mocks.generateCognitiveResponse.mockResolvedValue(parseAuraAssistantPlan({ content: "Proposed", actions: [], memoryUpdates: [], experience: {
      kind: "decision", title: "Goal", summary: "Review", phases: [], choices: [confirm, cancel], recommendedSurface: "intelligence",
    } }));
    const executor = { execute: vi.fn() };
    const controller = new ConversationController({ conversations, contextRetriever: createContextRetriever(), intelligenceActionExecutor: executor });
    const proposed = await controller.send("Create goal", "Context");
    const persistedChoice = conversations.getConversation(conversations.getSnapshot().activeConversationId!)!
      .messages.find((message) => message.messageId === proposed.assistantMessageId)!.structuredResponse!.experience!.choices[0];
    const remote = new LocalConversationRepository({ synchronize: false, persistLocally: false });
    remote.createConversation({ conversationId: conversations.getSnapshot().activeConversationId! });
    Object.assign(conversations, { flush: vi.fn(async () => {
      conversations.replaceSnapshotResult(remote.getSnapshot());
      throw new AuthenticatedConversationPersistenceError("IAURA_STATE_STALE_WRITE");
    }) });

    await expect(controller.sendChoice(persistedChoice, proposed.assistantMessageId, "Context"))
      .rejects.toMatchObject({ code: "IAURA_CONVERSATION_STALE_CONFIRMATION" });
    expect(executor.execute).not.toHaveBeenCalled();
  });

  it("application-binds a provider-retargeted project proposal to its exact conversation authority", async () => {
    const conversations = new LocalConversationRepository({ synchronize: false, persistLocally: false });
    const projectA = { id: "project-a", name: "Project A", goal: "A" } as IAuraProject;
    const projects = {
      getActiveProject: vi.fn(() => projectA),
      getProject: vi.fn((id: string) => id === projectA.id ? projectA : null),
      getProjects: vi.fn(() => [projectA]),
    } as unknown as ProjectRepository;
    const proposal = {
      operation: "intelligence_create_goal" as const, scopeType: "project" as const,
      projectId: "project-b", expectedActiveProjectId: "project-b", projectName: "Project A",
      currentSummary: "None", proposedSummary: "Goal A", title: "Goal A",
    };
    const confirm = { label: "Confirm", description: "Create", prompt: "Confirm", confirmation: { kind: "intelligence-action" as const, decision: "confirm" as const, proposal } };
    const cancel = { ...confirm, label: "Cancel", confirmation: { ...confirm.confirmation, decision: "cancel" as const } };
    mocks.analyze.mockReturnValue(cognitiveRequest);
    mocks.generateCognitiveResponse.mockResolvedValue(parseAuraAssistantPlan({ content: "Proposed", experience: {
      kind: "decision", title: "Goal", summary: "Review", phases: [], choices: [confirm, cancel], recommendedSurface: "intelligence",
    } }));
    const controller = new ConversationController({ conversations, projects, contextRetriever: createContextRetriever() });

    const result = await controller.send("Create Goal A", "Context", {
      scopeType: "project", projectId: "project-a",
    });
    const persisted = conversations.listConversations()[0].messages
      .find((message) => message.messageId === result.assistantMessageId)!
      .structuredResponse!.experience!.choices[0].confirmation;
    expect(persisted?.kind === "intelligence-action" ? persisted.proposal : null).toMatchObject({
      projectId: "project-a",
      expectedActiveProjectId: "project-a",
      projectName: "Project A",
    });
  });

  it("retains bridge authority for a focused Presencia follow-up until a proposal is produced", async () => {
    const projectA = { id: "project-a", name: "Proyecto A", goal: "A" } as IAuraProject;
    const projects = {
      getActiveProject: vi.fn(() => projectA),
      getProject: vi.fn((id: string) => id === projectA.id ? projectA : null),
      getProjects: vi.fn(() => [projectA]),
    } as unknown as ProjectRepository;
    const conversations = new LocalConversationRepository({ synchronize: false, persistLocally: false });
    const remoteConversations = new LocalConversationRepository({ synchronize: false, persistLocally: false });
    Object.assign(conversations, { flush: vi.fn(async () => {
      expect(remoteConversations.replaceSnapshotResult(conversations.getSnapshot()).ok).toBe(true);
    }) });
    const wrongProposal = {
      operation: "intelligence_create_priority" as const, scopeType: "project" as const,
      projectId: "build-product", expectedActiveProjectId: "build-product", projectName: "Proyecto A",
      currentSummary: "None", proposedSummary: "Add verification", title: "Visual Intelligence Verification", goalId: null,
    };
    const choices = ["confirm", "cancel"].map((decision) => ({
      label: decision, description: decision, prompt: decision,
      confirmation: {
        kind: "intelligence-action" as const,
        decision: decision as "confirm" | "cancel",
        proposal: decision === "cancel"
          ? { ...wrongProposal, expectedActiveProjectId: "parser-discarded-mismatch" }
          : wrongProposal,
      },
    }));
    const rawProviderProse = "I’ll prepare a project-scoped Intelligence change for ‘Build a product idea.’";
    const providerPlan = parseAuraAssistantPlan({ content: rawProviderProse, experience: {
      kind: "decision",
      title: "Project-scoped Intelligence change for “Build a product idea”",
      summary: "Prepare a project-scoped Intelligence change for “Build a product idea”",
      phases: [{ title: "Project-scoped Intelligence change for “Build a product idea”", description: "Review the project-scoped Intelligence change for “Build a product idea”" }],
      choices: choices.map((choice) => ({
        ...choice,
        label: "Review project-scoped Intelligence change for “Build a product idea”",
        description: "Apply project-scoped Intelligence change for “Build a product idea”",
        prompt: "Confirm project-scoped Intelligence change for “Build a product idea”",
      })),
      recommendedSurface: "intelligence",
    } });
    expect(choices).toHaveLength(2);
    expect(choices.map((choice) => choice.confirmation.decision)).toEqual(["confirm", "cancel"]);
    expect(providerPlan.experience.choices.filter((choice) =>
      choice.confirmation?.kind === "intelligence-action").map((choice) =>
      choice.confirmation?.kind === "intelligence-action" ? choice.confirmation.decision : null)).toEqual(["confirm"]);
    expect(providerPlan.content).toContain("Build a product idea");
    mocks.analyze.mockReturnValue(cognitiveRequest);
    mocks.generateCognitiveResponse
      .mockResolvedValueOnce(createAssistantPlan("What priority?", []))
      .mockResolvedValueOnce(providerPlan);
    const controller = new ConversationController({ conversations, projects, contextRetriever: createContextRetriever() });

    await controller.send("Help shape priorities", "Context", { scopeType: "project", projectId: "project-a" });
    const result = await controller.send("Add Visual Intelligence Verification for this project", "Context");
    expect(result.plan.content).toContain("Proyecto A");
    expect(result.plan.content).not.toContain("Build a product idea");
    const persisted = conversations.listConversations()[0].messages
      .find((message) => message.messageId === result.assistantMessageId)!
      .structuredResponse!.experience!.choices[0].confirmation;
    const persistedChoices = conversations.listConversations()[0].messages
      .find((message) => message.messageId === result.assistantMessageId)!
      .structuredResponse!.experience!.choices;
    expect(persistedChoices).toHaveLength(2);
    expect(persistedChoices.map((choice) => choice.confirmation?.kind === "intelligence-action"
      ? choice.confirmation.decision : null)).toEqual(["confirm", "cancel"]);
    expect(persistedChoices[0].confirmation?.kind === "intelligence-action" &&
      persistedChoices[1].confirmation?.kind === "intelligence-action"
      ? persistedChoices[0].confirmation.proposal.executionId === persistedChoices[1].confirmation.proposal.executionId
      : false).toBe(true);
    expect(persisted?.kind === "intelligence-action" ? persisted.proposal : null).toMatchObject({
      projectId: "project-a", expectedActiveProjectId: "project-a", projectName: "Proyecto A",
    });
    expect(JSON.stringify(persisted)).not.toContain("Build a product idea");
    const persistedMessage = conversations.listConversations()[0].messages
      .find((message) => message.messageId === result.assistantMessageId)!;
    expect(persistedMessage.content).toContain("Proyecto A");
    expect(persistedMessage.structuredResponse?.experience?.choices[0].prompt).toContain("Proyecto A");
    expect(JSON.stringify(persistedMessage.structuredResponse)).not.toContain("Build a product idea");

    const authoritativeSnapshot = remoteConversations.getSnapshot();
    const authoritativeMessage = authoritativeSnapshot.conversations[0].messages
      .find((message) => message.messageId === result.assistantMessageId)!;
    expect(authoritativeMessage.content).toContain("Proyecto A");
    expect(JSON.stringify(authoritativeMessage)).not.toContain("Build a product idea");

    const hydratedRepository = new LocalConversationRepository({ synchronize: false, persistLocally: false });
    expect(hydratedRepository.replaceSnapshotResult(authoritativeSnapshot).ok).toBe(true);
    const hydrated = loadVisibleConversation(hydratedRepository, "project-a")
      .find((message) => message.id === result.assistantMessageId)!;
    expect(hydrated.content).toContain("Proyecto A");
    expect(JSON.stringify(hydrated)).not.toContain("Build a product idea");
    expect(hydrated.experience?.choices).toHaveLength(2);
  });

  it("keeps a stale Project A source bound to A after Project B becomes active", async () => {
    const conversations = new LocalConversationRepository({ synchronize: false, persistLocally: false });
    const projectA = { id: "project-a", name: "Project A", goal: "A" } as IAuraProject;
    const projectB = { id: "project-b", name: "Project B", goal: "B" } as IAuraProject;
    let activeProject = projectA;
    const projects = { getActiveProject: vi.fn(() => activeProject) } as unknown as ProjectRepository;
    const proposal = {
      operation: "intelligence_create_goal" as const, scopeType: "project" as const,
      projectId: "project-a", expectedActiveProjectId: "project-a", projectName: "Project A",
      currentSummary: "None", proposedSummary: "Goal A", title: "Goal A",
    };
    const confirm = { label: "Confirm", description: "Create", prompt: "Confirm", confirmation: { kind: "intelligence-action" as const, decision: "confirm" as const, proposal } };
    const cancel = { ...confirm, label: "Cancel", confirmation: { ...confirm.confirmation, decision: "cancel" as const } };
    mocks.analyze.mockReturnValue(cognitiveRequest);
    mocks.generateCognitiveResponse.mockResolvedValue(parseAuraAssistantPlan({ content: "Proposed", experience: {
      kind: "decision", title: "Goal", summary: "Review", phases: [], choices: [confirm, cancel], recommendedSurface: "intelligence",
    } }));
    const executor = { execute: vi.fn().mockImplementation(async (capturedProposal: typeof proposal, sourceMessageId: string) => ({
      receiptId: "receipt-stale-project", sourceMessageId, operation: capturedProposal.operation,
      scopeType: capturedProposal.scopeType, projectId: capturedProposal.projectId, status: "stale" as const,
      summary: "The active project changed after this proposal was created. No Intelligence change was applied.",
    })) };
    const controller = new ConversationController({ conversations, projects, contextRetriever: createContextRetriever(), intelligenceActionExecutor: executor });
    const proposed = await controller.send("Create Goal A", "Context");
    const persistedChoice = conversations.listConversations()[0].messages
      .find((message) => message.messageId === proposed.assistantMessageId)!.structuredResponse!.experience!.choices[0];
    activeProject = projectB;

    const result = await controller.sendChoice(persistedChoice, proposed.assistantMessageId, "Context");

    expect(result.plan.content).toContain("Status: stale");
    expect(result.plan.content).toContain("No Intelligence change was applied");
    expect(executor.execute).toHaveBeenCalledWith(
      expect.objectContaining({ projectId: "project-a", expectedActiveProjectId: "project-a" }),
      proposed.assistantMessageId,
      projectB,
    );
  });

  it("cancels a persisted Intelligence proposal with zero mutation writes", async () => {
    const conversations = new LocalConversationRepository({ synchronize: false, persistLocally: false });
    const proposal = {
      operation: "intelligence_create_goal" as const, scopeType: "global" as const,
      projectId: null, expectedActiveProjectId: null, projectName: null,
      currentSummary: "None", proposedSummary: "Goal", title: "Goal",
    };
    const cancel = { label: "Cancel", description: "No change", prompt: "Cancel", confirmation: { kind: "intelligence-action" as const, decision: "cancel" as const, proposal } };
    const confirm = { ...cancel, label: "Confirm", prompt: "Confirm", confirmation: { ...cancel.confirmation, decision: "confirm" as const } };
    const plan = parseAuraAssistantPlan({ content: "Proposed", actions: [], memoryUpdates: [], experience: {
      kind: "decision", title: "Goal", summary: "Review", phases: [], choices: [confirm, cancel], recommendedSurface: "intelligence",
    } });
    const executor = { execute: vi.fn() };
    mocks.analyze.mockReturnValue(cognitiveRequest); mocks.generateCognitiveResponse.mockResolvedValue(plan);
    const controller = new ConversationController({ conversations, contextRetriever: createContextRetriever(), intelligenceActionExecutor: executor });
    const proposed = await controller.send("Maybe", "Context");
    const persistedChoice = conversations.getConversation(conversations.getSnapshot().activeConversationId!)!
      .messages.find((message) => message.messageId === proposed.assistantMessageId)!.structuredResponse!.experience!.choices[1];
    await controller.sendChoice(persistedChoice, proposed.assistantMessageId, "Context");
    expect(executor.execute).not.toHaveBeenCalled();
  });
});
