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
} from "../ConversationRepository";
import {
  ConversationController,
} from "../ConversationController";
import type { ProjectRepository } from "@/core/project/ProjectRepository";
import type { IAuraProject } from "@/types/project";
import { parseAuraAssistantPlan } from "@/core/actions";
import { DEFAULT_MEMORY } from "@/constants/memory";
import { buildUserContext } from "@/utils/context";

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

    await controller.sendChoice(plan.experience.choices[0], "recommendation-source", "Context");
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
});
