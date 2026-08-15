import { beforeEach, describe, expect, it } from "vitest";

import {
  LocalConversationRepository,
  type ConversationRepository,
} from "@/core/conversation";
import {
  canApplyConversationHydration,
  didActiveProjectChange,
  loadVisibleConversation,
} from "../conversationHydration";
import {
  initialConversationVisibleStart,
  visibleConversationMessages,
} from "../conversationWindowing";

describe("project conversation hydration", () => {
  beforeEach(() => {
    window.localStorage.clear();
  });

  it("keeps complete hydrated history while deriving a recent presentation window", () => {
    const conversations = new LocalConversationRepository();
    const created = conversations.createConversation({
      projectId: "long-project",
    }).conversation!;
    for (let index = 1; index <= 35; index += 1) {
      conversations.appendMessage(created.conversationId, {
        messageId: `long-${index}`,
        role: index % 2 === 0 ? "assistant" : "user",
        content: `Long message ${index}`,
      });
    }

    const reloaded = new LocalConversationRepository();
    const complete = loadVisibleConversation(reloaded, "long-project");
    const visible = visibleConversationMessages(
      complete,
      initialConversationVisibleStart(complete.length),
    );

    expect(reloaded.getActiveConversation("long-project")?.messages).toHaveLength(35);
    expect(complete).toHaveLength(35);
    expect(visible).toHaveLength(10);
    expect(visible[0].id).toBe("long-26");
    expect(visible.at(-1)?.id).toBe("long-35");
  });

  it("distinguishes a same-project object refresh from a real project change", () => {
    expect(didActiveProjectChange("project-a", "project-a")).toBe(false);
    expect(didActiveProjectChange("project-a", "project-b")).toBe(true);
    expect(didActiveProjectChange("project-a", null)).toBe(true);
  });

  it("rejects hydration after newer optimistic message activity", () => {
    expect(canApplyConversationHydration({
      requestedProjectId: "project-a",
      activeProjectId: "project-a",
      scheduledMessageGeneration: 4,
      currentMessageGeneration: 5,
    })).toBe(false);
  });

  it("rejects hydration requested for a project that is no longer active", () => {
    expect(canApplyConversationHydration({
      requestedProjectId: "project-a",
      activeProjectId: "project-b",
      scheduledMessageGeneration: 4,
      currentMessageGeneration: 4,
    })).toBe(false);
  });

  it("allows unchanged initial or project-change hydration exactly once", () => {
    expect(canApplyConversationHydration({
      requestedProjectId: "project-a",
      activeProjectId: "project-a",
      scheduledMessageGeneration: 0,
      currentMessageGeneration: 0,
    })).toBe(true);
  });

  it("restores persisted messages after repository reconstruction without duplicates", () => {
    const first = new LocalConversationRepository();
    const created = first.createConversation({
      conversationId: "conversation-a",
      projectId: "project-a",
    });
    first.appendMessage(created.conversation!.conversationId, {
      messageId: "message-a",
      role: "user",
      content: "Only once",
    });

    const reloaded = new LocalConversationRepository();

    expect(loadVisibleConversation(reloaded, "project-a")).toEqual([{
      id: "message-a",
      role: "user",
      content: "Only once",
    }]);
    expect(loadVisibleConversation(reloaded, "project-a")).toHaveLength(1);
  });

  it("uses the existing clean-prose presentation convention for hydrated assistant text only", () => {
    const conversations = new LocalConversationRepository();
    const created = conversations.createConversation({ projectId: "project-a" })
      .conversation!;
    conversations.appendMessage(created.conversationId, {
      messageId: "user-markdown", role: "user", content: "I wrote **partial**.",
    });
    conversations.appendMessage(created.conversationId, {
      messageId: "assistant-markdown", role: "assistant",
      content: "The result is **partial** and remains provisional.",
    });

    const visible = loadVisibleConversation(conversations, "project-a");

    expect(visible[0].content).toBe("I wrote **partial**.");
    expect(visible[1].content).toBe("The result is partial and remains provisional.");
    expect(conversations.getActiveConversation("project-a")?.messages[1].content)
      .toBe("The result is **partial** and remains provisional.");
  });

  it("switches A to B to A without leaking messages across projects", () => {
    const conversations = new LocalConversationRepository();
    const projectA = conversations.createConversation({
      conversationId: "conversation-a",
      projectId: "project-a",
    }).conversation!;
    conversations.appendMessage(projectA.conversationId, {
      messageId: "message-a",
      role: "user",
      content: "Project A only",
    });
    const projectB = conversations.createConversation({
      conversationId: "conversation-b",
      projectId: "project-b",
    }).conversation!;
    conversations.appendMessage(projectB.conversationId, {
      messageId: "message-b",
      role: "assistant",
      content: "Project B only",
    });

    expect(loadVisibleConversation(conversations, "project-a")[0].content)
      .toBe("Project A only");
    expect(loadVisibleConversation(conversations, "project-b")[0].content)
      .toBe("Project B only");
    expect(loadVisibleConversation(conversations, "project-a")[0].content)
      .toBe("Project A only");
    expect(loadVisibleConversation(conversations, "project-b"))
      .not.toEqual(expect.arrayContaining([
        expect.objectContaining({ content: "Project A only" }),
      ]));
  });

  it("reconstructs a persisted assistant card from validated experience data", () => {
    const conversations = new LocalConversationRepository();
    const created = conversations.createConversation({
      projectId: "project-a",
    }).conversation!;
    conversations.appendMessage(created.conversationId, {
      role: "assistant",
      content: "Open the project.",
      structuredResponse: {
        actionTypes: [],
        experienceKind: "project",
        recommendedSurface: "projects",
        experience: {
          kind: "project",
          title: "Continue",
          summary: "Resume the project.",
          phases: [],
          choices: [],
          recommendedSurface: "projects",
        },
      },
    });

    expect(loadVisibleConversation(
      new LocalConversationRepository(),
      "project-a",
    )[0].experience).toMatchObject({
      title: "Continue",
      recommendedSurface: "projects",
    });
  });

  it("hydrates a project-isolated next-step card from its assistant message", () => {
    const conversations = new LocalConversationRepository();
    const iaura = conversations.createConversation({ projectId: "iaura" }).conversation!;
    conversations.appendMessage(iaura.conversationId, {
      role: "assistant",
      content: "Recommended.",
      structuredResponse: {
        actionTypes: [], experienceKind: "project", recommendedSurface: "presence",
        betaNextStep: {
          action: "Ship one card", whyNow: "The outcome is clear",
          result: "A visible recommendation", doneWhen: "It survives reload",
        },
      },
    });
    conversations.createConversation({ projectId: "nova" });

    expect(loadVisibleConversation(conversations, "iaura")[0].betaNextStep)
      .toEqual({
        action: "Ship one card", whyNow: "The outcome is clear",
        result: "A visible recommendation", doneWhen: "It survives reload",
      });
    expect(loadVisibleConversation(conversations, "nova")).toEqual([]);
  });

  it("hydrates confirmed state only onto its trusted source recommendation", () => {
    const conversations = new LocalConversationRepository();
    const conversation = conversations.createConversation({ projectId: "iaura" }).conversation!;
    conversations.appendMessage(conversation.conversationId, {
      messageId: "source", role: "assistant", content: "Next",
      structuredResponse: {
        actionTypes: [], experienceKind: "decision", recommendedSurface: "presence",
        betaNextStep: { action: "Build", whyNow: "Now", result: "Card", doneWhen: "Visible" },
      },
    });
    conversations.updateConversationMetadata(conversation.conversationId, {
      betaWorkflow: {
        version: 1, status: "ready-to-start",
        confirmedContext: { goal: "G", blocker: "B", summary: "S", sourceMessageId: "c", confirmedAt: "2026-08-13T12:00:00Z" },
        confirmedOutcome: { outcome: "O", doneWhen: "D", sourceMessageId: "o", confirmedAt: "2026-08-13T12:01:00Z" },
        confirmedNextStep: { action: "Build", whyNow: "Now", result: "Card", doneWhen: "Visible", sourceMessageId: "source", confirmedAt: "2026-08-13T12:02:00Z" },
      },
    });

    expect(loadVisibleConversation(new LocalConversationRepository(), "iaura")[0])
      .toMatchObject({ id: "source", betaNextStepConfirmed: true });
  });

  it("hydrates a persisted session decision onto the confirmed step", () => {
    const conversations = new LocalConversationRepository();
    const conversation = conversations.createConversation({ projectId: "iaura" }).conversation!;
    conversations.appendMessage(conversation.conversationId, {
      messageId: "step", role: "assistant", content: "Next",
      structuredResponse: { actionTypes: [], experienceKind: "decision", recommendedSurface: "presence",
        betaNextStep: { action: "A", whyNow: "W", result: "R", doneWhen: "D" } },
    });
    conversations.updateConversationMetadata(conversation.conversationId, { betaWorkflow: {
      version: 1, status: "deferred",
      confirmedContext: { goal: "G", blocker: "B", summary: "S", sourceMessageId: "c", confirmedAt: "2026-08-13T12:00:00Z" },
      confirmedOutcome: { outcome: "O", doneWhen: "D", sourceMessageId: "o", confirmedAt: "2026-08-13T12:01:00Z" },
      confirmedNextStep: { action: "A", whyNow: "W", result: "R", doneWhen: "D", sourceMessageId: "step", confirmedAt: "2026-08-13T12:02:00Z" },
      sessionDecision: { kind: "continue-later", sourceMessageId: "decision", decidedAt: "2026-08-13T12:03:00Z" },
    } });
    expect(loadVisibleConversation(new LocalConversationRepository(), "iaura")[0])
      .toMatchObject({ betaNextStepConfirmed: true, betaSessionDecision: "continue-later" });
  });

  it("retains active ready-to-start decisions through hydration until one is confirmed", () => {
    const conversations = new LocalConversationRepository();
    const conversation = conversations.createConversation({ projectId: "ready-project" })
      .conversation!;
    conversations.appendMessage(conversation.conversationId, {
      messageId: "ready-decision", role: "assistant", content: "Choose when to start.",
      structuredResponse: {
        actionTypes: [], experienceKind: "decision", recommendedSurface: "presence",
        experience: {
          kind: "decision", title: "Ready", summary: "Choose", phases: [],
          choices: [
            { label: "Empezar ahora", description: "Start", prompt: "Start", confirmation: {
              kind: "beta-session-decision", decision: "start-now",
            } },
            { label: "Continuar después", description: "Later", prompt: "Later", confirmation: {
              kind: "beta-session-decision", decision: "continue-later",
            } },
          ], recommendedSurface: "presence",
        },
      },
    });
    conversations.updateConversationMetadata(conversation.conversationId, {
      betaWorkflow: {
        version: 1, status: "ready-to-start",
        confirmedContext: { goal: "G", blocker: "B", summary: "S", sourceMessageId: "context", confirmedAt: "2026-08-14T10:00:00Z" },
        confirmedOutcome: { outcome: "O", doneWhen: "D", sourceMessageId: "outcome", confirmedAt: "2026-08-14T10:01:00Z" },
        confirmedNextStep: { action: "Run tests", whyNow: "Now", result: "R", doneWhen: "D", sourceMessageId: "step", confirmedAt: "2026-08-14T10:02:00Z" },
      },
    });

    const hydrated = loadVisibleConversation(
      new LocalConversationRepository(), "ready-project",
    );
    expect(hydrated[0].experience?.choices.map((choice) => choice.label))
      .toEqual(["Empezar ahora", "Continuar después"]);
    expect(hydrated[0]).not.toHaveProperty("betaSessionDecisionConfirmed");
  });

  it("hydrates project-scoped provisional and verified execution state", () => {
    const conversations = new LocalConversationRepository();
    const conversation = conversations.createConversation({ projectId: "iaura" }).conversation!;
    conversations.appendMessage(conversation.conversationId, {
      messageId: "report", role: "user", content: "I tested it.",
    });
    conversations.appendMessage(conversation.conversationId, {
      messageId: "evaluation", role: "assistant", content: "Review.",
      structuredResponse: {
        actionTypes: [], experienceKind: "decision", recommendedSurface: "presence",
        sourceUserMessageId: "report",
        betaExecutionEvaluation: {
          result: "partial", observation: "Some behavior worked", doneWhenSatisfied: false,
        },
      },
    });
    conversations.appendMessage(conversation.conversationId, {
      messageId: "recovery", role: "assistant", content: "Choose recovery.",
      structuredResponse: {
        actionTypes: [], experienceKind: "decision", recommendedSurface: "presence",
        experience: {
          kind: "decision", title: "Recovery", summary: "Same step", phases: [],
          choices: [{ label: "Continuar después", description: "Later", prompt: "Later", confirmation: {
            kind: "beta-incomplete-execution-recovery", decision: "retry-later",
          } }], recommendedSurface: "presence",
        },
      },
    });
    conversations.updateConversationMetadata(conversation.conversationId, { betaWorkflow: {
      version: 1, status: "started",
      confirmedContext: { goal: "G", blocker: "B", summary: "S", sourceMessageId: "c", confirmedAt: "2026-08-13T12:00:00Z" },
      confirmedOutcome: { outcome: "O", doneWhen: "D", sourceMessageId: "o", confirmedAt: "2026-08-13T12:01:00Z" },
      confirmedNextStep: { action: "A", whyNow: "W", result: "R", doneWhen: "D", sourceMessageId: "n", confirmedAt: "2026-08-13T12:02:00Z" },
      sessionDecision: { kind: "start-now", sourceMessageId: "d", decidedAt: "2026-08-13T12:03:00Z" },
      verifiedExecutions: [{ evidenceId: "e", result: "partial", observation: "Some behavior worked", doneWhenSatisfied: false, sourceUserMessageId: "report", sourceMessageId: "evaluation", verifiedAt: "2026-08-13T12:04:00Z" }],
      incompleteExecutionRecoveries: [{ decision: "retry-later", evidenceId: "e", sourceMessageId: "recovery", confirmedAt: "2026-08-13T12:05:00Z" }],
    } });
    conversations.appendMessage(conversation.conversationId, {
      messageId: "resume", role: "assistant", content: "Resume the same step.",
      structuredResponse: {
        actionTypes: [], experienceKind: "decision", recommendedSurface: "presence",
        experience: {
          kind: "decision", title: "Resume", summary: "Pending", phases: [],
          choices: [{ label: "Empezar ahora", description: "Resume", prompt: "Resume", confirmation: {
            kind: "beta-session-decision", decision: "start-now",
          } }], recommendedSurface: "presence",
        },
      },
    });
    expect(loadVisibleConversation(conversations, "iaura")[3])
      .not.toHaveProperty("betaSessionDecisionConfirmed");
    conversations.updateConversationMetadata(conversation.conversationId, {
      betaWorkflow: {
        ...conversations.getConversation(conversation.conversationId)!.betaWorkflow!,
        status: "started",
        sessionDecision: {
          kind: "start-now", sourceMessageId: "resume", decidedAt: "2026-08-13T12:06:00Z",
        },
      },
    });
    conversations.createConversation({ projectId: "nova" });

    expect(loadVisibleConversation(conversations, "iaura")[1]).toMatchObject({
      id: "evaluation",
      betaExecutionEvaluation: { result: "partial", doneWhenSatisfied: false },
      betaExecutionVerified: true,
    });
    expect(loadVisibleConversation(new LocalConversationRepository(), "iaura")[2])
      .toMatchObject({
        id: "recovery",
        betaIncompleteExecutionRecoveryDecision: "retry-later",
      });
    expect(loadVisibleConversation(new LocalConversationRepository(), "iaura")[3])
      .toMatchObject({
        id: "resume",
        content: "Resume the same step.",
        betaSessionDecisionConfirmed: true,
      });
    expect(loadVisibleConversation(conversations, "nova")).toEqual([]);
  });

  it("hydrates provisional and confirmed session review state from trusted workflow binding", () => {
    const conversations = new LocalConversationRepository();
    const conversation = conversations.createConversation({ projectId: "iaura" }).conversation!;
    conversations.appendMessage(conversation.conversationId, {
      messageId: "report", role: "user", content: "Passed.",
    });
    conversations.appendMessage(conversation.conversationId, {
      messageId: "step-evaluation", role: "assistant", content: "Passed.",
      structuredResponse: {
        actionTypes: [], experienceKind: "decision", recommendedSurface: "presence",
        sourceUserMessageId: "report",
        betaExecutionEvaluation: { result: "passed", observation: "Passed", doneWhenSatisfied: true },
      },
    });
    conversations.appendMessage(conversation.conversationId, {
      messageId: "session-review", role: "assistant", content: "Review.",
      structuredResponse: {
        actionTypes: [], experienceKind: "decision", recommendedSurface: "presence",
        betaSessionEvaluation: { outcomeSatisfied: false, summary: "More remains" },
      },
    });
    expect(loadVisibleConversation(conversations, "iaura")[2]).toMatchObject({
      betaSessionEvaluation: { outcomeSatisfied: false, summary: "More remains" },
    });
    conversations.updateConversationMetadata(conversation.conversationId, { betaWorkflow: {
      version: 1, status: "evaluated",
      confirmedContext: { goal: "G", blocker: "B", summary: "S", sourceMessageId: "c", confirmedAt: "2026-08-13T12:00:00Z" },
      confirmedOutcome: { outcome: "O", doneWhen: "D", sourceMessageId: "o", confirmedAt: "2026-08-13T12:01:00Z" },
      confirmedNextStep: { action: "A", whyNow: "W", result: "R", doneWhen: "D", sourceMessageId: "n", confirmedAt: "2026-08-13T12:02:00Z" },
      sessionDecision: { kind: "start-now", sourceMessageId: "d", decidedAt: "2026-08-13T12:03:00Z" },
      verifiedExecutions: [{ evidenceId: "e", result: "passed", observation: "Passed", doneWhenSatisfied: true, sourceUserMessageId: "report", sourceMessageId: "step-evaluation", verifiedAt: "2026-08-13T12:04:00Z" }],
      sessionEvaluation: { outcomeSatisfied: false, summary: "More remains", sourceMessageId: "session-review", confirmedAt: "2026-08-13T12:05:00Z" },
    } });
    expect(loadVisibleConversation(conversations, "iaura")[2]).toMatchObject({
      betaSessionEvaluationConfirmed: true,
    });
    expect(loadVisibleConversation(conversations, "iaura")[2])
      .not.toHaveProperty("betaSessionClosed");
  });

  it("hydrates archived closed workflow flags without leaking them into the fresh cycle", () => {
    const completed = {
      version: 1 as const, status: "closed" as const,
      confirmedContext: { goal: "G", blocker: "B", summary: "S", sourceMessageId: "c", confirmedAt: "2026-08-13T12:00:00Z" },
      confirmedOutcome: { outcome: "O", doneWhen: "D", sourceMessageId: "o", confirmedAt: "2026-08-13T12:01:00Z" },
      confirmedNextStep: { action: "A", whyNow: "W", result: "R", doneWhen: "D", sourceMessageId: "n", confirmedAt: "2026-08-13T12:02:00Z" },
      sessionDecision: { kind: "start-now" as const, sourceMessageId: "d", decidedAt: "2026-08-13T12:03:00Z" },
      verifiedExecutions: [{ evidenceId: "e", result: "passed" as const, observation: "Passed", doneWhenSatisfied: true, sourceUserMessageId: "report", sourceMessageId: "execution", verifiedAt: "2026-08-13T12:04:00Z" }],
      sessionEvaluation: { outcomeSatisfied: true, summary: "Satisfied", sourceMessageId: "review", confirmedAt: "2026-08-13T12:05:00Z" },
      sessionClosure: { sourceMessageId: "close", closedAt: "2026-08-13T12:06:00Z" },
      postClosureHandoff: { decision: "begin-another-cycle" as const, sourceMessageId: "handoff", confirmedAt: "2026-08-13T12:07:00Z" },
    };
    const conversation = {
      conversationId: "history", projectId: "iaura", title: "IAURA", status: "active" as const,
      createdAt: "2026-08-13T12:00:00Z", updatedAt: "2026-08-13T12:08:00Z",
      lastAccessedAt: "2026-08-13T12:08:00Z", revision: 1,
      messages: [
        { messageId: "execution", role: "assistant" as const, content: "Passed", createdAt: "2026-08-13T12:04:00Z", structuredResponse: { actionTypes: [], experienceKind: "decision" as const, recommendedSurface: "presence" as const, betaExecutionEvaluation: { result: "passed" as const, observation: "Passed", doneWhenSatisfied: true } } },
        { messageId: "review", role: "assistant" as const, content: "Review", createdAt: "2026-08-13T12:05:00Z", structuredResponse: { actionTypes: [], experienceKind: "decision" as const, recommendedSurface: "presence" as const, betaSessionEvaluation: { outcomeSatisfied: true, summary: "Satisfied" } } },
        { messageId: "handoff", role: "assistant" as const, content: "Handoff", createdAt: "2026-08-13T12:07:00Z", structuredResponse: { actionTypes: [], experienceKind: "decision" as const, recommendedSurface: "presence" as const } },
        { messageId: "fresh", role: "assistant" as const, content: "Fresh cycle", createdAt: "2026-08-13T12:08:00Z" },
      ],
      completedBetaWorkflows: [completed],
    };
    const conversations = {
      getActiveConversation: (projectId?: string | null) => projectId === "iaura" ? conversation : null,
    } as Pick<ConversationRepository, "getActiveConversation">;

    const hydrated = loadVisibleConversation(conversations, "iaura");
    expect(hydrated[0]).toMatchObject({ betaExecutionVerified: true });
    expect(hydrated[2]).toMatchObject({
      betaSessionClosed: true,
      betaPostClosureDecision: "begin-another-cycle",
    });
    expect(hydrated[3]).not.toHaveProperty("betaSessionClosed");
    expect(hydrated[3]).not.toHaveProperty("betaExecutionVerified");
    expect(loadVisibleConversation(conversations, "nova")).toEqual([]);
  });
});
